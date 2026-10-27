import json
import os
import unittest
from unittest.mock import patch

import account_auth as accounts
import line_archive as archive
import line_moves as moves
import site_controls as controls

# Nothing here may reach the real KV store (see test_site_access.py).
_kv_off = patch.object(accounts, '_kv', return_value=None)


def setUpModule():
    _kv_off.start()


def tearDownModule():
    _kv_off.stop()


class FakeKV:
    """The KV commands line_moves uses, in memory."""

    def __init__(self):
        self.data = {}
        self.calls = 0
        self.log = []

    def __call__(self, commands, timeout=None):
        self.calls += len(commands)
        self.log.extend(commands)
        return [self.run(*command) for command in commands]

    def run(self, name, key, *args):
        if name == 'GET':
            return self.data.get(key)
        if name == 'SET':
            if 'NX' in args and key in self.data:
                return None
            self.data[key] = args[0]
            return 'OK'
        if name == 'DEL':
            return int(self.data.pop(key, None) is not None)
        if name == 'HSET':
            table = self.data.setdefault(key, {})
            for field, value in zip(args[0::2], args[1::2]):
                table[field] = str(value)
            return len(args) // 2
        if name == 'HSETNX':
            table = self.data.setdefault(key, {})
            if args[0] in table:
                return 0
            table[args[0]] = args[1]
            return 1
        if name == 'EXPIRE':
            return 1
        if name == 'HGETALL':
            return [item for pair in self.data.get(key, {}).items() for item in pair]
        if name == 'HMGET':
            return [self.data.get(key, {}).get(field) for field in args]
        if name == 'HDEL':
            table = self.data.get(key, {})
            return sum(table.pop(field, None) is not None for field in args)
        if name == 'HLEN':
            return len(self.data.get(key, {}))
        if name == 'LPUSH':
            items = self.data.setdefault(key, [])
            for value in args:
                items.insert(0, value)
            return len(items)
        if name == 'LTRIM':
            self.data[key] = self.data.get(key, [])[args[0]:args[1] + 1]
            return 'OK'
        if name == 'LRANGE':
            return self.data.get(key, [])[args[0]:args[1] + 1]
        raise AssertionError(name)


T0 = 1_790_000_000.0


def pp(player, stat, line, updated=T0 - 600, **extra):
    return {'id': f'{player}-{stat}', 'league': 'MLB', 'player': player, 'stat': stat, 'line': line,
            'odds_type': 'standard', 'updated_at': moves._iso(updated), 'headshot': f'{player}.png', 'team': 'NYY',
            'description': 'BOS', 'start_time': '2026-09-29T23:05:00+00:00', 'combo': False, 'flash': False, **extra}


def quote(book, player, stat, line, over=-110, under=-110, **extra):
    return {'book': book, 'player': player, 'stat': stat, 'line': line, 'over': over, 'under': under,
            'alternate': False, 'startsAt': '2026-09-29T23:05:00Z', **extra}


class Base(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()
        moves._last.clear()
        moves._checked_at.clear()
        moves._opening_seeded.clear()
        moves._polled.clear()
        for patcher in (patch.object(moves, '_pipeline', self.kv), patch.object(moves.store, 'KV_URL', 'https://kv.test'),
                        patch.object(moves.store, 'KV_TOKEN', 'test-only'),
                        patch.dict(os.environ, {'LINE_MOVES': '1'})):
            patcher.start()
            self.addCleanup(patcher.stop)

    def listed(self):
        return [json.loads(item) for item in self.kv.data.get(moves.LIST_KEY, [])]


class LineArchiveTests(Base):
    """Each NBA line's last number before its game, kept by game day."""

    def setUp(self):
        super().setUp()
        archive._written.clear()

    def nba(self, player, stat, line, start='2026-10-22T02:30:00+00:00', **extra):
        return pp(player, stat, line, league='NBA', start_time=start, **extra)

    def test_the_last_number_before_the_game_is_kept_by_its_us_day(self):
        moves.observe_prizepicks('NBA', [self.nba('Jeremiah Fears', 'Pts+Rebs', 13.5),
                                         self.nba('Derik Queen', 'Pts+Rebs', 13.5, start='2026-10-21T23:30:00+00:00')], fetched_at=T0)
        moves.observe_prizepicks('NBA', [self.nba('Jeremiah Fears', 'Pts+Rebs', 14.5)], fetched_at=T0 + 120)
        # A 10:30 pm Eastern tip (02:30 the next day in UTC) is still the 21st.
        self.assertEqual(archive.lines_on('nba', '2026-10-21', self.kv),
                         {'jeremiahfears|ptsrebs': 14.5, 'derikqueen|ptsrebs': 13.5})

    def test_an_unchanged_number_is_not_written_again(self):
        rows = [self.nba('Jeremiah Fears', 'Points', 9.5)]
        moves.observe_prizepicks('NBA', rows, fetched_at=T0)
        before = self.kv.calls
        moves.observe_prizepicks('NBA', rows, fetched_at=T0 + 120)
        self.assertFalse(any(name == 'HSET' and str(key).startswith(archive.PREFIX)
                             for name, key, *_ in self.kv.log[before:]))

    def test_nfl_lines_are_kept_too(self):
        # A Sunday 1 pm Eastern kickoff, read back on its own day.
        moves.observe_prizepicks('NFL', [pp('Jahmyr Gibbs', 'Rush Yards', 79.5, league='NFL', start_time='2026-10-25T17:00:00+00:00')],
                                 fetched_at=T0)
        self.assertEqual(archive.lines_on('nfl', '2026-10-25', self.kv), {'jahmyrgibbs|rushyards': 79.5})

    def test_one_players_numbers_by_day(self):
        moves.observe_prizepicks('NBA', [self.nba('Jeremiah Fears', 'Points', 12.5), self.nba('Jeremiah Fears', 'Rebounds', 4.5),
                                         self.nba('Derik Queen', 'Points', 13.5)], fetched_at=T0)
        self.assertEqual(archive.player_lines('nba', 'jeremiahfears', ['points', 'assists'], ['2026-10-21', '2026-10-20'], self.kv),
                         {'2026-10-21': {'points': 12.5}})
        self.assertEqual(archive.player_lines('nba', 'jeremiahfears', [], ['2026-10-21'], self.kv), {})
        self.assertEqual(archive.player_lines('mlb', 'aaronjudge', ['totalbases'], ['2026-10-21'], self.kv), {})

    def test_started_games_goblins_and_other_leagues_are_left_out(self):
        moves.observe_prizepicks('NBA', [self.nba('A', 'Points', 9.5, start=moves._iso(T0 - 60)),
                                         self.nba('B', 'Points', 7.5, odds_type='goblin')], fetched_at=T0)
        moves.observe_prizepicks('MLB', [pp('Aaron Judge', 'Total Bases', 1.5)], fetched_at=T0)
        self.assertFalse([key for key in self.kv.data if str(key).startswith(archive.PREFIX)])


class PrizePicksTests(Base):
    def test_one_players_moves(self):
        nba = lambda player, line: pp(player, 'Points', line, league='NBA', start_time='2026-10-22T02:30:00+00:00')
        moves.observe_prizepicks('NBA', [nba('Jeremiah Fears', 12.5), nba('Derik Queen', 13.5)], fetched_at=T0)
        moves.observe_prizepicks('NBA', [nba('Jeremiah Fears', 13.5), nba('Derik Queen', 14.5)], fetched_at=T0 + 120)
        moves.observe_prizepicks('NBA', [nba('Jeremiah Fears', 14.5), nba('Derik Queen', 14.5)], fetched_at=T0 + 240)
        mine = moves.player_moves('nba', 'JEREMIAH  fears')
        self.assertEqual([(move['from'], move['to']) for move in mine], [(13.5, 14.5), (12.5, 13.5)])
        self.assertEqual(moves.player_moves('mlb', 'Jeremiah Fears'), [])

    def test_first_look_records_nothing_then_a_new_number_is_a_move(self):
        self.assertEqual(moves.observe_prizepicks('MLB', [pp('Aaron Judge', 'Total Bases', 1.5)], fetched_at=T0), [])
        found = moves.observe_prizepicks('MLB', [pp('Aaron Judge', 'Total Bases', 2.5, updated=T0 + 50)], fetched_at=T0 + 120)
        self.assertEqual(len(found), 1)
        move = found[0]
        self.assertEqual((move['sport'], move['kind'], move['app'], move['player'], move['stat']),
                         ('mlb', 'line', 'prizepicks', 'Aaron Judge', 'Total Bases'))
        self.assertEqual((move['from'], move['to'], move['change']), (1.5, 2.5, 1.0))
        # PrizePicks' own update time, not when it was noticed.
        self.assertEqual(move['at'], moves._iso(T0 + 50))
        self.assertEqual((move['team'], move['opponent'], move['headshot']), ('NYY', 'BOS', 'Aaron Judge.png'))
        self.assertEqual(self.listed(), found)
        self.assertEqual(moves.recent({'mlb'})['checked'], {'mlb': moves._iso(T0 + 120)})

    def test_unchanged_lines_goblins_demons_combos_and_flash_sales_are_not_moves(self):
        base = [pp('A', 'Hits', 0.5), pp('B', 'Hits', 1.5), pp('C', 'Runs', 0.5)]
        moves.observe_prizepicks('MLB', base, fetched_at=T0)
        found = moves.observe_prizepicks('MLB', [
            pp('A', 'Hits', 0.5, updated=T0 + 10),
            pp('B', 'Hits', 1.5), pp('B', 'Hits', 2.5, odds_type='goblin'), pp('B', 'Hits', 3.5, odds_type='demon'),
            pp('C', 'Runs', 1.5, flash=True), pp('A + B', 'Hits', 3.5, combo=True)], fetched_at=T0 + 120)
        self.assertEqual(found, [])

    def test_a_line_that_drops_out_and_returns_on_another_number_still_counts(self):
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5), pp('B', 'Hits', 1.5)], fetched_at=T0)
        moves.observe_prizepicks('MLB', [pp('B', 'Hits', 1.5)], fetched_at=T0 + 120)
        found = moves.observe_prizepicks('MLB', [pp('A', 'Hits', 1.5), pp('B', 'Hits', 1.5)], fetched_at=T0 + 240)
        self.assertEqual([(move['player'], move['from'], move['to']) for move in found], [('A', 0.5, 1.5)])

    def test_an_older_feed_arriving_late_is_ignored(self):
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0)
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 1.5)], fetched_at=T0 + 200)
        moves._last.clear()
        self.assertEqual(moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0 + 100), [])
        self.assertEqual(len(self.listed()), 1)

    def test_another_server_mid_compare_is_left_alone(self):
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0)
        self.kv.data[f'{moves.PREFIX}:lock:mlb:pp'] = '1'
        self.assertEqual(moves.observe_prizepicks('MLB', [pp('A', 'Hits', 1.5)], fetched_at=T0 + 120), [])

    def test_a_repeat_feed_costs_almost_nothing(self):
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0)
        calls = self.kv.calls
        # Same numbers, only PrizePicks' update time changed.
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5, updated=T0 + 30)], fetched_at=T0 + 60)
        self.assertEqual(self.kv.calls, calls)
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0 + 200)
        self.assertEqual(self.kv.calls, calls + 1)  # just "checked"

    def test_an_unknown_league_no_storage_or_a_local_run_does_nothing(self):
        self.assertEqual(moves.observe_prizepicks('CBB', [pp('A', 'Points', 20.5)]), [])
        with patch.object(moves.store, 'KV_URL', ''):
            self.assertEqual(moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)]), [])
        # Credentials on a developer's machine are not enough: only the
        # deployed site keeps moves.
        env = {key: value for key, value in os.environ.items()
               if key not in ('VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'LINE_MOVES')}
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)]), [])
            self.assertEqual(moves.observe_books('mlb', [quote('draftkings', 'A', 'Hits', 0.5)]), [])
            moves.keep_fresh({'mlb'}, fetch=lambda league: self.fail('fetched'))
        with patch.dict(os.environ, {'VERCEL': '1'}):
            self.assertTrue(moves.enabled())
        self.assertEqual(self.kv.calls, 0)

    def test_the_feed_reports_every_fresh_fetch_and_never_fails_for_it(self):
        import prizepicks_export_core as core
        payload = {'data': [{'id': '1', 'type': 'projection', 'attributes': {
            'status': 'pre_game', 'line_score': 1.5, 'stat_type': 'Hits', 'odds_type': 'standard',
            'start_time': '2026-09-29T23:05:00Z', 'updated_at': '2026-09-29T20:00:00Z'},
            'relationships': {'league': {'data': {'id': '2'}}, 'new_player': {'data': {'id': '9'}}}}],
            'included': [{'id': '9', 'type': 'new_player', 'attributes': {'display_name': 'A', 'team': 'NYY'}}]}

        class Response:
            def raise_for_status(self):
                pass

            def json(self):
                return payload
        core._PROJECTION_CACHE.clear()
        self.addCleanup(core._PROJECTION_CACHE.clear)
        with patch.object(core.requests, 'get', return_value=Response()), \
                patch.object(moves, 'observe_prizepicks', side_effect=RuntimeError('boom')) as observe:
            rows = core._fetch_projection_rows(league='MLB')
        self.assertEqual([row['line'] for row in rows], [1.5])
        self.assertFalse(rows[0]['flash'])
        observe.assert_called_once()
        self.assertEqual(observe.call_args.args[:2], ('MLB', rows))


class BookTests(Base):
    def test_a_books_main_line_moving_is_a_line_move_with_the_players_face(self):
        moves.observe_prizepicks('MLB', [pp('Aaron Judge', 'Total Bases', 1.5)], fetched_at=T0)
        moves.observe_books('mlb', [quote('draftkings', 'Aaron Judge', 'Total Bases', 1.5)], fetched_at=T0)
        found = moves.observe_books('mlb', [quote('draftkings', 'Aaron Judge', 'Total Bases', 2.5, -105, -125),
                                            quote('draftkings', 'Aaron Judge', 'Total Bases', 3.5, 150, -200, alternate=True)],
                                    fetched_at=T0 + 1800)
        self.assertEqual(len(found), 1)
        move = found[0]
        self.assertEqual((move['kind'], move['app'], move['appName'], move['from'], move['to'], move['change']),
                         ('line', 'draftkings', 'DraftKings', 1.5, 2.5, 1.0))
        self.assertEqual((move['headshot'], move['team'], move['over'], move['under']), ('Aaron Judge.png', 'NYY', -105, -125))

    def test_a_price_move_at_the_same_number_counts_from_three_points(self):
        moves.observe_books('wnba', [quote('fanduel', 'A', 'Points', 20.5, -110, -110),
                                     quote('fanduel', 'B', 'Points', 12.5, -110, -110)], fetched_at=T0)
        found = moves.observe_books('wnba', [quote('fanduel', 'A', 'Points', 20.5, -135, 105),
                                             quote('fanduel', 'B', 'Points', 12.5, -118, -104)], fetched_at=T0 + 600)
        self.assertEqual(len(found), 1)
        move = found[0]
        self.assertEqual((move['kind'], move['player'], move['side'], move['from'], move['to'], move['line']),
                         ('odds', 'A', 'over', -110, -135, 20.5))
        self.assertGreater(move['change'], 3)

    def test_prizepicks_alternates_and_doubled_main_lines_are_not_book_moves(self):
        moves.observe_books('nfl', [quote('prizepicks', 'A', 'Rush Yds', 50.5), quote('underdog', 'A', 'Rush Yds', 50.5),
                                    quote('underdog', 'A', 'Rush Yds', 60.5)], fetched_at=T0)
        found = moves.observe_books('nfl', [quote('prizepicks', 'A', 'Rush Yds', 55.5), quote('underdog', 'A', 'Rush Yds', 52.5),
                                            quote('underdog', 'A', 'Rush Yds', 62.5)], fetched_at=T0 + 600)
        self.assertEqual(found, [])


class OpeningTests(Base):
    def test_the_first_number_is_kept_and_never_overwritten(self):
        start = '2099-10-11T17:00:00Z'
        moves.observe_books('nfl', [quote('draftkings', 'Josh Allen', 'Pass Yards', 245.5, startsAt=start)], fetched_at=T0)
        moves.observe_books('nfl', [quote('draftkings', 'Josh Allen', 'Pass Yards', 250.5, -115, -105, startsAt=start)],
                            fetched_at=T0 + 600)
        found = moves.openings('nfl')['books']
        key = next(iter(found['open']))
        self.assertTrue(key.startswith('draftkings|joshallen|passyards|'))
        self.assertEqual(found['open'][key][:3], [245.5, -110, -110])
        self.assertEqual(found['now'][key][:3], [250.5, -115, -105])

    def test_other_sports_record_no_openings(self):
        moves.observe_books('mlb', [quote('draftkings', 'Aaron Judge', 'Total Bases', 1.5)], fetched_at=T0)
        self.assertFalse(any(':open:' in key for key in self.kv.data))
        self.assertEqual(moves.openings('mlb'), {})


class PageTests(Base):
    def test_recent_is_newest_first_and_only_the_viewers_leagues(self):
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 0.5)], fetched_at=T0)
        moves.observe_prizepicks('NHL', [pp('B', 'Shots', 2.5)], fetched_at=T0)
        moves.observe_prizepicks('MLB', [pp('A', 'Hits', 1.5, updated=T0 + 100)], fetched_at=T0 + 120)
        moves.observe_prizepicks('NHL', [pp('B', 'Shots', 3.5, updated=T0 + 200)], fetched_at=T0 + 240)
        self.assertEqual([move['sport'] for move in moves.recent({'mlb', 'nhl'})['moves']], ['nhl', 'mlb'])
        only = moves.recent({'mlb'})
        self.assertEqual([move['sport'] for move in only['moves']], ['mlb'])
        self.assertEqual(set(only['checked']), {'mlb'})

    def test_keep_fresh_checks_each_league_once_across_servers(self):
        fetched = []
        moves.keep_fresh({'mlb', 'nhl'}, fetch=lambda league: fetched.append(league))
        self.assertEqual(sorted(fetched), ['MLB', 'NHL'])
        moves._polled.clear()  # another server
        moves.keep_fresh({'mlb', 'nhl', 'soccer'}, fetch=lambda league: fetched.append(league))
        self.assertEqual(sorted(fetched), ['MLB', 'NHL', 'SOCCER'])


class SwitchTests(unittest.TestCase):
    def test_line_moves_starts_off_until_the_admin_turns_it_on(self):
        old = {**controls.DEFAULT, 'disabledTabs': ['nrfi'], 'finderSportsSeen': list(controls.FINDER_SPORTS)}
        with patch.object(controls.store, 'get', return_value=json.dumps(old)):
            # (Slip to PrizePicks, admin-only until it got its switch, starts off too, and so does My Bets.)
            self.assertEqual(controls.read()['disabledTabs'], ['bets', 'bot', 'export', 'moves', 'nrfi', 'promos', 'sheets'])
        with patch.object(controls.store, 'get', return_value=None):
            self.assertIn('moves', controls.read()['disabledTabs'])
        saved = controls.validate({**controls.DEFAULT, 'disabledTabs': []})
        self.assertEqual(saved['tabsSeen'], list(controls.TABS))
        with patch.object(controls.store, 'get', return_value=json.dumps(saved)):
            self.assertEqual(controls.read()['disabledTabs'], [])

    def test_the_page_follows_its_switch_and_the_league_switches(self):
        import io
        from api.board import handler
        import site_members

        def call(admin, policy):
            request = object.__new__(handler)
            request.path = '/api/board?view=moves'
            request.headers = {}
            request.wfile = io.BytesIO()
            with patch.object(controls, 'read', return_value=policy), \
                    patch.object(controls.admin_auth, 'is_admin_request', return_value=admin), \
                    patch.object(site_members, 'read_rules', return_value={}), \
                    patch('api.board.session_with_live_access', return_value={'id': 'u'}), \
                    patch.object(moves, 'keep_fresh') as fresh, \
                    patch.object(moves, 'recent', side_effect=lambda sports: {'moves': [], 'checked': {}}), \
                    patch.object(request, '_send') as send:
                request.do_GET()
            return send.call_args.args, fresh
        off = {**controls.DEFAULT, 'disabledTabs': ['moves'], 'disabledFinderSports': ['soccer']}
        (status, body), _ = call(False, off)
        self.assertEqual((status, body.get('featureDisabled')), (503, True))
        (status, body), fresh = call(True, off)
        self.assertEqual((status, body['sports']), (200, [sport for sport in controls.FINDER_SPORTS if sport in moves.SPORTS]))
        on = {**off, 'disabledTabs': []}
        (status, body), fresh = call(False, on)
        self.assertEqual((status, body['sports']), (200, ['wnba', 'mlb', 'nfl', 'nhl', 'nba', 'cs2', 'cfb']))
        self.assertEqual(fresh.call_args.args[0], ['wnba', 'mlb', 'nfl', 'nhl', 'nba', 'cs2', 'cfb'])


if __name__ == '__main__':
    unittest.main()
