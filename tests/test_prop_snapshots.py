"""Phase 0 of the NBA prop model work: the pregame records (prop_snapshots.py),
the evaluation (prop_eval.py) and the snapshot job's access (snapshot_runner.py)."""
import json
import math
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import prop_eval  # noqa: E402
import prop_snapshots as snaps  # noqa: E402
import props_record  # noqa: E402


class FakeKV:
    """Enough of Redis for these records."""

    def __init__(self):
        self.data, self.calls = {}, []

    def __call__(self, commands):
        self.calls.append(commands)
        return [self.run(*command) for command in commands]

    def run(self, op, *args):
        op = op.upper()
        data = self.data
        if op == 'SET':
            key, value, *rest = args
            if 'NX' in rest and key in data:
                return None
            data[key] = str(value)
            return 'OK'
        if op == 'GET':
            return data.get(args[0])
        if op == 'DEL':
            return sum(1 for key in args if data.pop(key, None) is not None)
        if op in ('RPUSH', 'LPUSH'):
            items = data.setdefault(args[0], [])
            for value in args[1:]:
                items.append(value) if op == 'RPUSH' else items.insert(0, value)
            return len(items)
        if op == 'LTRIM':
            data[args[0]] = data.get(args[0], [])[args[1]:args[2] + 1]
            return 'OK'
        if op == 'LRANGE':
            items = data.get(args[0], [])
            return items[args[1]:] if args[2] == -1 else items[args[1]:args[2] + 1]
        if op == 'LLEN':
            return len(data.get(args[0], []))
        if op == 'HSET':
            table = data.setdefault(args[0], {})
            for field, value in zip(args[1::2], args[2::2]):
                table[field] = str(value)
            return 1
        if op == 'HSETNX':
            table = data.setdefault(args[0], {})
            if args[1] in table:
                return 0
            table[args[1]] = args[2]
            return 1
        if op == 'HGETALL':
            return [part for item in data.get(args[0], {}).items() for part in item]
        if op == 'HMGET':
            table = data.get(args[0], {})
            return [table.get(field) for field in args[1:]]
        if op == 'HGET':
            return data.get(args[0], {}).get(args[1])
        if op == 'HLEN':
            return len(data.get(args[0], {}))
        if op == 'STRLEN':
            return len(data.get(args[0], ''))
        if op == 'EXPIRE':
            return 1
        if op == 'DBSIZE':
            return len(data)
        raise AssertionError(op)


NOW = 1_795_000_000.0  # 2026-11-18 ~ 08:26 UTC
TIP = NOW + 10 * 3600


def pp_row(pp, line, player='Stephen Curry', odds='standard', start=TIP, **extra):
    return {'id': pp, 'line': line, 'player': player, 'player_id': '99', 'team': 'GSW', 'description': 'LAL', 'stat': 'Points',
            'odds_type': odds, 'start_time': start, **extra}


class LineTests(unittest.TestCase):
    def setUp(self):
        self.kv, self.memory = FakeKV(), {'fp': None, 'days': {}}

    def feed(self, rows, at):
        return snaps.observe_lines(rows, at, pipeline=self.kv, memory=self.memory)

    def test_only_changes_are_written_and_moves_are_kept(self):
        board = [pp_row(f'p{n}', 10.5 + n, player=f'P{n}') for n in range(10)] + [pp_row('g1', 8.5, odds='goblin')]
        self.assertEqual(self.feed(board, NOW), 11)
        # The same feed again: nothing.
        self.assertEqual(self.feed(board, NOW + 90), 0)
        calls = len(self.kv.calls)
        self.assertEqual(self.feed([dict(row) for row in board], NOW + 180), 0)
        self.assertEqual(len(self.kv.calls), calls)
        # One line moves, one is taken down hours before its game.
        moved = [dict(row, line=row['line'] + 1) if row['id'] == 'p3' else row for row in board if row['id'] != 'p5']
        self.assertEqual(self.feed(moved, NOW + 270), 2)
        day = snaps.day_of(TIP)
        history = snaps.line_history(day, self.kv)
        self.assertEqual([move[1] for move in history['p3']['moves']], [13.5, 14.5])
        self.assertEqual(history['p5']['moves'][-1][1], None)
        self.assertEqual(history['g1']['meta'][5], 'goblin')
        # A server starting cold reads what is kept and repeats nothing.
        cold = {'fp': None, 'days': {}}
        self.assertEqual(snaps.observe_lines(moved, NOW + 360, pipeline=self.kv, memory=cold), 0)
        closing = snaps.closing_lines(day, self.kv)
        self.assertEqual((closing[('P3', 'Points', 'standard')], closing[('P5', 'Points', 'standard')], closing[('Stephen Curry', 'Points', 'goblin')]),
                         (14.5, None, 8.5))

    def test_an_incomplete_feed_takes_nothing_down_and_started_games_are_left_out(self):
        board = [pp_row(f'p{n}', 10.5) for n in range(10)]
        self.feed(board, NOW)
        # Most of the feed missing at once: a page that failed, not lines pulled.
        self.assertEqual(self.feed(board[:3], NOW + 90), 0)
        history = snaps.line_history(snaps.day_of(TIP), self.kv)
        self.assertTrue(all(entry['moves'][-1][1] == 10.5 for entry in history.values()))
        # A game already started is never recorded.
        self.assertEqual(self.feed([pp_row('late', 5.5, start=NOW - 60)], NOW + 200), 0)

    def test_a_line_gone_as_its_game_starts_is_not_a_pull(self):
        board = [pp_row(f'p{n}', 10.5, start=NOW + 300) for n in range(5)] + [pp_row('q', 3.5)] * 1
        self.feed(board, NOW)
        self.feed([row for row in board if row['id'] != 'p0'], NOW + 120)
        history = snaps.line_history(snaps.day_of(NOW + 300), self.kv)
        self.assertEqual([move[1] for move in history['p0']['moves']], [10.5])


class FakeDepth:
    def __init__(self, status='ok'):
        self.charts = {'abc': {slot: [f'{slot}1', f'{slot}2'] for slot in ('pg', 'sg', 'sf', 'pf', 'c')}}
        self.status = status

    def chart_before(self, team, tip):
        return ('abc', int(NOW // 60) - 600, self.status) if self.status == 'ok' else (None, None, self.status)


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()
        self.games = [{'id': '401', 'start': TIP, 'state': 'pre', 'home': 'GS', 'away': 'LAL'},
                      {'id': '402', 'start': NOW - 60, 'state': 'in', 'home': 'BOS', 'away': 'NY'}]

    def report(self, injuries, fetched=NOW - 60, starters=None):
        return lambda event_id: {'fetchedAt': fetched, 'injuries': injuries, 'starters': starters or {}}

    def test_reports_are_kept_when_they_change_with_the_time_they_were_read(self):
        injuries = {'GS': [{'id': '1', 'name': 'A', 'status': 'Out', 'code': 'O'}], 'LAL': []}
        first = snaps.check_reports(self.games, NOW, self.kv, report_of=self.report(injuries), depth_index=FakeDepth())
        self.assertEqual(first['games'], 1)
        events = snaps.reports_on(snaps.day_of(TIP), self.kv)
        self.assertEqual(sorted(event['k'] for event in events), ['inj', 'inj', 'proj', 'proj'])
        gs = next(event for event in events if event['k'] == 'inj' and event['t'] == 'GS')
        self.assertEqual(gs['v'][0][:3], ['1', 'A', 'Out'])
        self.assertEqual(gs['f'], int(NOW - 60))
        proj = next(event for event in events if event['k'] == 'proj')
        self.assertEqual(proj['v']['starters']['pg'], 'pg1')
        # Unchanged: nothing new. Changed: one new version.
        snaps.check_reports(self.games, NOW + 600, self.kv, report_of=self.report(injuries), depth_index=FakeDepth())
        self.assertEqual(len(snaps.reports_on(snaps.day_of(TIP), self.kv)), 4)
        changed = {'GS': [{'id': '1', 'name': 'A', 'status': 'Questionable', 'code': 'GTD'}], 'LAL': []}
        snaps.check_reports(self.games, NOW + 1200, self.kv, report_of=self.report(changed, fetched=NOW + 1100), depth_index=FakeDepth())
        events = snaps.reports_on(snaps.day_of(TIP), self.kv)
        self.assertEqual(len(events), 5)
        self.assertEqual(events[-1]['v'][0][2], 'Questionable')

    def test_stale_missing_and_failed_reports_are_logged_not_trusted(self):
        snaps.check_reports(self.games, NOW, self.kv, report_of=self.report({}, fetched=NOW - 3600), depth_index=FakeDepth('stale'))
        kinds = {json.loads(item)['kind'] for item in self.kv.data[snaps.key('health')]}
        self.assertEqual(kinds, {'report-stale', 'report-missing', 'depth-stale'})
        # No injury version is written from a report ESPN didn't publish.
        self.assertFalse(any(event['k'] == 'inj' for event in snaps.reports_on(snaps.day_of(TIP), self.kv)))

        def broken(event_id):
            raise ConnectionError('down')
        kv = FakeKV()
        found = snaps.check_reports(self.games, NOW, kv, report_of=broken, depth_index=None)
        self.assertEqual(found['failed'], 1)
        self.assertIn('report-failed', {json.loads(item)['kind'] for item in kv.data[snaps.key('health')]})

    def test_confirmed_starters_are_recorded_when_espn_names_them_before_tip(self):
        starters = {'GS': ['1', '2', '3', '4', '5']}
        found = snaps.check_reports(self.games, NOW, self.kv, report_of=self.report({'GS': []}, starters=starters), depth_index=None)
        self.assertEqual(found['confirmed'], 1)
        confirmed = [event for event in snaps.reports_on(snaps.day_of(TIP), self.kv) if event['k'] == 'conf']
        self.assertEqual(confirmed[0]['v'], ['1', '2', '3', '4', '5'])
        self.assertEqual(confirmed[0]['src'], 'espn before tip')

    def test_a_missing_graded_run_is_logged_while_games_are_close(self):
        soon = [{'id': '1', 'start': NOW + 3600, 'state': 'pre', 'home': 'A', 'away': 'B'}]
        self.assertTrue(snaps.watch_runs(soon, NOW, self.kv)['missing'])
        self.assertIn('run-missing', {json.loads(item)['kind'] for item in self.kv.data[snaps.key('health')]})
        self.kv.data[snaps.key('status')] = {'run': json.dumps({'at': NOW - 600})}
        self.assertFalse(snaps.watch_runs(soon, NOW, self.kv)['missing'])
        self.assertFalse(snaps.watch_runs([], NOW, self.kv)['due'])

    def test_the_timer_checks_once_per_window(self):
        calls = []
        games_of = lambda now: calls.append(now) or self.games
        snaps.tick(NOW, self.kv, games_of=games_of, report_of=self.report({'GS': []}), depth_index=FakeDepth())
        self.assertEqual(snaps.tick(NOW + 90, self.kv, games_of=games_of, report_of=self.report({'GS': []}), depth_index=FakeDepth()), {'waiting': True})
        self.assertEqual(len(calls), 1)


def graded(pp='1', line=26.5, over=0.55, under=0.45, modifier='standard', start=TIP, pid='3975', market='player_points', **extra):
    side = lambda chance, tier: [chance, chance, chance, tier, None, 0.5, None, chance, chance, 0.2, 1]
    return {'pid': pid, 'pl': 'Stephen Curry', 'tm': 'GS', 'op': 'LAL', 'mk': market, 'ln': line, 'md': modifier,
            'st': start, 'pp': pp, 'sc': 60, 'o': side(over, 'lean'), 'u': side(under, 'risky') if modifier == 'standard' else None,
            'pj': 27.1, 'm': [33, 0.82, 32, 14, 0.7, 0.2], 'dk': [0.53, 26.5, -120, 100, 0], 'ro': [1, 0, 10, 10], 'ns': None,
            'lg': '2026-11-16', 'gn': 14, **extra}


class RunTests(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()

    def test_a_run_is_kept_whole_and_each_line_once_with_its_changes(self):
        body = {'sha': 'abc1234', 'model': {'hash': 'm1'}, 'data': {'board': 'x', 'big': {'no': 1}}, 'inputs': {'tonight': {'GS': {}}},
                'rows': [graded(), graded(pp='2', line=22.5, modifier='goblin'), graded(pp='3', start=NOW - 60), {'pid': 'bad'}]}
        report = snaps.accept_run(body, NOW, self.kv, site_sha='abc1234')
        self.assertEqual((report['kept'], report['late'], report['rejected']), (2, 1, 1))
        day = snaps.day_of(TIP)
        run = snaps.unpack(self.kv.data[snaps.key('run', day, int(NOW))])
        self.assertEqual(run['inputs'], {'tonight': {'GS': {}}})
        self.assertEqual(len(run['rows']), 2)
        meta = snaps.runs_on(day, self.kv)[0]
        self.assertEqual(meta['data'], {'board': 'x'})
        last = snaps.last_on(day, self.kv)
        self.assertEqual(set(last), {'3975|player_points|26.5|standard', '3975|player_points|22.5|goblin'})
        self.assertIsNone(last['3975|player_points|22.5|goblin']['row']['u'])
        # The same grades again: last seen moves, nothing else.
        snaps.accept_run({**body, 'rows': [graded()]}, NOW + 1800, self.kv)
        entry = snaps.last_on(day, self.kv)['3975|player_points|26.5|standard']
        self.assertEqual((entry['f'], entry['l'], entry['n'], len(entry['tr'])), (int(NOW), int(NOW + 1800), 1, 1))
        # A changed grade: a second point on its trail.
        snaps.accept_run({**body, 'rows': [graded(over=0.58, under=0.42)]}, NOW + 3600, self.kv)
        entry = snaps.last_on(day, self.kv)['3975|player_points|26.5|standard']
        self.assertEqual((entry['n'], [point[2] for point in entry['tr']]), (2, [0.55, 0.58]))
        status = json.loads(self.kv.data[snaps.key('status')]['run'])
        self.assertEqual((status['at'], status['rows']), (int(NOW + 3600), 1))

    def test_a_failed_run_is_logged_and_never_counts_as_a_run(self):
        report = snaps.accept_run({'sha': 'x', 'problems': ['The run failed: board 503'], 'rows': []}, NOW, self.kv)
        self.assertEqual(report['kept'], 0)
        self.assertNotIn('run', self.kv.data.get(snaps.key('status'), {}))
        self.assertIn('attempt', self.kv.data[snaps.key('status')])
        texts = [json.loads(item)['text'] for item in self.kv.data[snaps.key('health')]]
        self.assertIn('The run failed: board 503', texts)

    def test_a_job_on_other_code_than_the_site_is_flagged(self):
        snaps.accept_run({'sha': 'aaaaaaaaaaaa', 'rows': [graded()]}, NOW, self.kv, site_sha='bbbbbbbbbbbb')
        self.assertIn('version', {json.loads(item)['kind'] for item in self.kv.data[snaps.key('health')]})

    def test_bad_values_are_dropped_not_kept(self):
        row = graded()
        row['o'][0] = 1.7
        row['u'] = None
        self.assertIsNone(snaps._clean_row(row))
        row = graded()
        row['mk'] = 'player_turnovers'
        self.assertIsNone(snaps._clean_row(row))

    def test_the_recording_report_shows_real_entries(self):
        snaps.accept_run({'sha': 'x', 'rows': [graded()]}, NOW, self.kv)
        snaps.observe_lines([pp_row('p1', 25.5)], NOW, pipeline=self.kv, memory={'fp': None, 'days': {}})
        out = snaps.recording(days=[snaps.day_of(TIP)], now=NOW, pipeline=self.kv)
        day = out['days'][0]
        self.assertEqual(day['grades']['lines'], 1)
        self.assertEqual(day['lines']['events'], 1)
        self.assertEqual(day['grades']['sample'][0]['pl'], 'Stephen Curry')
        self.assertEqual(out['keys'], len(self.kv.data))


# ---------------------------------------------------------------- evaluation

from backend.sports.wnba import context  # noqa: E402
from backend.sports.wnba.league import FIELDS  # noqa: E402


def box(pid, pts, minutes=30):
    values = {name: 0 for name in FIELDS}
    values.update(min=minutes, pts=pts, reb=5, ast=4)
    return [pid, 1, *[values[name] for name in FIELDS]]


def season(days_points):
    """{'games': ...}: one game a day, player '1' scoring days_points[day]."""
    games = {}
    for index, (day, points) in enumerate(days_points):
        games[str(index)] = {'id': str(index), 'date': f'{day}T23:00Z', 't': {'A': {'p': [box('1', points)] if points is not None else []},
                                                                              'B': {'p': [box('2', 10)]}}}
    return {'games': games, 'players': {}}


class EvaluationTests(unittest.TestCase):
    def test_lines_are_scored_once_per_player_night_with_baselines_from_earlier_nights_only(self):
        days = [f'2026-11-{n:02d}' for n in range(1, 13)]
        points = [20, 30, 22, 28, 25, 19, 31, 24, 26, None, 27, 18]
        payload = season(list(zip(days, points)))
        kv = FakeKV()
        for day, value in zip(days, points):
            # The list reported two standard lines for him that night (it moved), and one Goblin.
            kv.data[props_record.key(day)] = {'1|player_points|24.5': json.dumps([60, 0.56, 'lean', 'standard', 0.5, 0.55]),
                                              '1|player_points|25.5': json.dumps([60, 0.52, 'risky', 'standard', 0.5, None]),
                                              '1|player_points|20.5': json.dumps([60, 0.71, 'strong', 'goblin', 0.7, None])}
        now = props_record._start('2026-11-13T18:00:00Z')
        out = prop_eval.evaluate(days=12, now=now, pipeline=kv, payloads=[payload], stat_value=context.stat_value)
        listed = out['list']
        # Two standard lines a night: one counted (the middle: 24.5 of 24.5 and 25.5), one removed each night.
        self.assertEqual(listed['duplicatesRemoved'], 12)
        # The night he didn't play is void.
        self.assertEqual(listed['void'], 2)
        self.assertEqual(listed['standard'], 11)
        over = listed['over']
        self.assertEqual(over['n'], 11)
        self.assertEqual(over['playerGames'], 11)
        models = {entry['model']: entry for entry in over['summary']}
        self.assertEqual(set(models), {'production', 'line', 'average', 'coin', 'draftkings'} - ({'draftkings'} if models.get('draftkings') is None else set()))
        self.assertAlmostEqual(models['coin']['logLoss'], math.log(2), places=4)
        self.assertIsNotNone(models['production']['logLossCI'])
        # The Under is the list's 1 - Over, scored on its own outcome.
        self.assertEqual(listed['under']['n'], 11)
        self.assertAlmostEqual(listed['over']['hitRate'] + listed['under']['hitRate'], 1.0, places=6)
        # Goblins apart, Over only.
        self.assertEqual(listed['specials']['goblin']['n'], 11)

    def test_the_baselines_never_read_the_night_they_score(self):
        records = [{'pid': '1', 'day': f'2026-11-{n:02d}', 'mk': 'player_points', 'md': 'standard', 'ln': 10.5,
                    'actual': 20 if n % 2 else 0} for n in range(1, 6)]
        prop_eval.add_baselines(records, records, {})
        self.assertEqual(records[0]['pLine'], 0.5)
        # Night 2 knows only night 1 (an over): above even, below certain.
        self.assertTrue(0.5 < records[1]['pLine'] < 0.6)
        self.assertFalse(records[1]['avgFitted'])

    def test_a_player_average_is_only_his_earlier_games(self):
        days = [f'2026-11-{n:02d}' for n in range(1, 8)]
        found = prop_eval.averages(season(list(zip(days, [10, 20, 30, 40, 50, 60, 70]))), context.stat_value)
        self.assertNotIn(('1', days[4]), found)       # 4 earlier games: too few
        self.assertEqual(found[('1', days[5])][0]['pts'], 30.0)  # (10..50)/5
        self.assertEqual(found[('1', days[6])][1], 6)

    def test_correlated_props_widen_the_interval(self):
        import numpy as np
        rng = np.random.default_rng(1)
        values = np.array([1.0] * 50 + [0.0] * 50)
        alone = prop_eval._ci(prop_eval._weights(list(range(100)), rng), values)
        together = prop_eval._ci(prop_eval._weights([n // 10 for n in range(100)], rng), values)
        self.assertGreater(together[1] - together[0], alone[1] - alone[0])

    def test_job_records_take_the_latest_pregame_line(self):
        kv = FakeKV()
        day = '2026-11-18'
        early, late = graded(line=25.5, over=0.6, under=0.4), graded(line=26.5, over=0.5, under=0.5)
        kv.data[snaps.key('last', day)] = snaps.pack({'a': {'f': 1, 'l': 100, 'row': early}, 'b': {'f': 2, 'l': 200, 'row': late}})
        records, counts = prop_eval.job_records([day], {('3975', day): {'pts': 30}}, kv)
        self.assertEqual(counts['duplicatesRemoved'], 1)
        self.assertEqual(records[0]['ln'], 26.5)
        self.assertEqual((records[0]['pOver'], records[0]['pUnder'], records[0]['implied']), (0.5, 0.5, False))


class AccessTests(unittest.TestCase):
    def test_only_the_snapshot_workflow_token_is_taken_and_remembered(self):
        import snapshot_runner
        import github_oidc
        snapshot_runner._verified.clear()
        asked = []
        with patch.object(github_oidc, 'verify', side_effect=lambda token, **kw: asked.append(kw) or ({'exp': 4e9} if token == 'good' else None)):
            self.assertFalse(snapshot_runner.verified({}))
            self.assertFalse(snapshot_runner.verified({'X-GitHub-OIDC': 'bad'}))
            self.assertTrue(snapshot_runner.verified({'X-GitHub-OIDC': 'good'}))
            self.assertTrue(snapshot_runner.verified({'X-GitHub-OIDC': 'good'}))
        self.assertEqual(asked[0], {'audience': 'aceprops-nba-prop-snapshot', 'workflow': 'nba-prop-snapshot.yml'})
        self.assertEqual(len(asked), 2)  # the good token verified once


class RouteTests(unittest.TestCase):
    """The new routes: the job's token opens NBA reads and its own post, nothing else."""

    def load(self, name, file):
        import importlib.util
        from pathlib import Path
        spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / 'api' / file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def call(self, module, method, path, headers=None, body=None):
        import io
        request = object.__new__(module.handler)
        raw = json.dumps(body or {}).encode()
        request.path = path
        request.headers = {'Content-Length': str(len(raw)), **(headers or {})}
        request.rfile = io.BytesIO(raw)
        sent = []
        if hasattr(module, '_send') and not hasattr(module.handler, '_send'):
            with patch.object(module, '_send', side_effect=lambda handler, status, payload, *rest: sent.append((status, payload))):
                getattr(request, method)()
        else:
            with patch.object(request, '_send', side_effect=lambda status, payload, *rest, **kw: sent.append((status, payload))):
                getattr(request, method)()
        return sent[-1]

    def test_the_job_reads_nba_data_as_a_member_and_nothing_else(self):
        import snapshot_runner
        wnba = self.load('wnba_api_snap', 'wnba.py')
        token = {'X-GitHub-OIDC': 'good'}
        with patch.object(snapshot_runner, 'verified', side_effect=lambda headers: headers.get('X-GitHub-OIDC') == 'good'), \
                patch.object(wnba, 'session_with_live_access', return_value=None), \
                patch.object(wnba, '_nba_tonight', return_value={'teams': {}, 'fetchedAt': 'now'}):
            self.assertEqual(self.call(wnba, 'do_GET', '/api/wnba?league=nba&resource=tonight', token)[0], 200)
            # No token, a wrong one, or the WNBA: a member's session is still required.
            self.assertEqual(self.call(wnba, 'do_GET', '/api/wnba?league=nba&resource=tonight')[0], 401)
            self.assertEqual(self.call(wnba, 'do_GET', '/api/wnba?league=nba&resource=tonight', {'X-GitHub-OIDC': 'bad'})[0], 401)
            self.assertEqual(self.call(wnba, 'do_GET', '/api/wnba?resource=tonight', token)[0], 401)
            # It can't post the Props list's report either.
            self.assertEqual(self.call(wnba, 'do_POST', '/api/wnba?league=nba&resource=props-log', token, {'rows': []})[0], 401)

    def test_the_admin_report_and_the_run_post_need_an_admin_or_the_job(self):
        import snapshot_runner
        from v2.board import admin_auth
        admin = self.load('v2_admin_snap', 'v2-admin.py')
        with patch.object(snapshot_runner, 'verified', return_value=False), patch.object(admin_auth, 'is_admin_request', return_value=False):
            self.assertEqual(self.call(admin, 'do_GET', '/api/v2-admin?action=nba-prop-eval')[0], 401)
            self.assertEqual(self.call(admin, 'do_POST', '/api/v2-admin', {'X-GitHub-OIDC': 'x'}, {'action': 'nba-prop-snapshot', 'rows': []})[0], 401)
        kv = FakeKV()
        with patch.object(snapshot_runner, 'verified', return_value=True), patch.object(snaps, '_pipeline', kv):
            status, report = self.call(admin, 'do_POST', '/api/v2-admin', {'X-GitHub-OIDC': 'good'},
                                       {'action': 'nba-prop-snapshot', 'sha': 'x', 'rows': [graded(start=4e9)]})
            self.assertEqual((status, report['kept']), (200, 1))
            status, out = self.call(admin, 'do_GET', '/api/v2-admin?action=nba-prop-eval&part=recording', {'X-GitHub-OIDC': 'good'})
            self.assertEqual(status, 200)
            self.assertIn('recording', out)


if __name__ == '__main__':
    unittest.main()
