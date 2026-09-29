import io
import json
import os
import unittest
from unittest.mock import patch

import account_auth as accounts
import line_moves as moves
import pick_alerts as alerts
import push_notices as push
import site_controls as controls
from test_line_moves import T0, FakeKV, pp

_kv_off = patch.object(accounts, '_kv', return_value=None)


def setUpModule():
    _kv_off.start()


def tearDownModule():
    _kv_off.stop()


LATER = '2026-09-30T02:05:00+00:00'  # the game, well after T0


def line(player, stat, value, **extra):
    return pp(player, stat, value, start_time=LATER, **extra)


class Base(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()
        moves._last.clear()
        moves._checked_at.clear()
        moves._polled.clear()
        for patcher in (patch.object(moves, '_pipeline', self.kv), patch.object(push, '_pipeline', self.kv),
                        patch.object(moves.store, 'KV_URL', 'https://kv.test'), patch.dict(os.environ, {'LINE_MOVES': '1'})):
            patcher.start()
            self.addCleanup(patcher.stop)

    def look(self, rows, at):
        moves._last.clear()
        return moves.observe_prizepicks('MLB', rows, fetched_at=at)


class PulledTests(Base):
    def test_a_line_still_gone_on_the_next_look_before_its_game_is_pulled(self):
        board = [line('Aaron Judge', 'Total Bases', 1.5), line('Juan Soto', 'Walks', 0.5)]
        self.look(board, T0)
        self.assertEqual(self.look(board[1:], T0 + 120), [])  # gone once: could be a repost
        found = self.look(board[1:], T0 + 240)
        self.assertEqual(len(found), 1)
        move = found[0]
        self.assertEqual((move['kind'], move['player'], move['stat'], move['from'], move['to']),
                         ('pulled', 'Aaron Judge', 'Total Bases', 1.5, None))
        self.assertEqual((move['at'], move['team'], move['headshot']), (moves._iso(T0 + 120), 'NYY', 'Aaron Judge.png'))
        self.assertEqual(self.look(board[1:], T0 + 360), [])  # told once

    def test_a_quick_repost_a_started_game_a_new_start_time_or_a_broken_feed_is_not_a_pull(self):
        soon = pp('Soon', 'Hits', 0.5, start_time=moves._iso(T0 + 300))
        board = [line('A', 'Hits', 0.5), line('B', 'Hits', 0.5), soon] + [line(f'P{i}', 'Runs', 0.5) for i in range(40)]
        self.look(board, T0)
        # A dropped and reposted; Soon's game starts; B moves to a later start.
        later = pp('B', 'Hits', 0.5, start_time='2026-09-30T05:05:00+00:00')
        self.look([board[1]] + board[3:], T0 + 120)
        self.assertEqual(self.look([board[0], later] + board[3:], T0 + 240), [])
        self.assertEqual(self.look([board[0], later] + board[3:], T0 + 360), [])
        # Half the feed missing twice: a failed page, not forty pulls.
        self.look(board[:23], T0 + 480)
        self.assertEqual(self.look(board[:23], T0 + 600), [])


class MatchTests(unittest.TestCase):
    def test_saved_picks_match_prizepicks_names(self):
        self.assertEqual(alerts.stat_key('Points + Rebounds + Assists'), alerts.stat_key('Pts+Rebs+Asts'))
        self.assertEqual(alerts.stat_key('3-Pointers Made'), alerts.stat_key('3-PT Made'))
        self.assertEqual(alerts.stat_key('Fantasy Points'), alerts.stat_key('Fantasy Score'))
        self.assertNotEqual(alerts.stat_key('Hits'), alerts.stat_key('Hits+Runs+RBIs'))
        pick = alerts.pick_view({'sport': 'MLB', 'player': 'Aaron Judge', 'betType': 'Total Bases Label',
                                 'exportStat': 'Total Bases', 'line': '1.5', 'side': 'Over'})
        self.assertEqual(pick, {'sport': 'mlb', 'player': 'Aaron Judge', 'stat': 'Total Bases', 'line': 1.5,
                                'side': 'Over', 'modifier': 'standard'})
        # Older picks from the MLB pages carry no sport.
        self.assertEqual(alerts.pick_view({'player': 'A', 'betType': 'Hits', 'line': 0.5})['sport'], 'mlb')
        for bad in (None, {}, {'player': 'A', 'betType': 'Hits'}, {'player': 'A', 'line': 1}, {'sport': 'nba', 'player': 'A', 'betType': 'Pts', 'line': 1}):
            self.assertIsNone(alerts.pick_view(bad))

    def test_the_message_says_whose_pick_and_where_it_went(self):
        pick = {'sport': 'mlb', 'player': 'Aaron Judge', 'stat': 'Total Bases', 'line': 1.5, 'side': 'Over', 'modifier': 'standard'}
        moved = {'sport': 'mlb', 'kind': 'line', 'app': 'prizepicks', 'player': 'Aaron Judge', 'stat': 'Total Bases', 'from': 1.5, 'to': 2.5}
        message = alerts.message(pick, moved)
        self.assertEqual((message['title'], message['body']), ('Line moved', 'Your Aaron Judge 1.5 Total Bases just moved to 2.5.'))
        self.assertEqual(message['url'], '/finder?sport=mlb&player=Aaron+Judge&stat=Total+Bases')
        self.assertEqual(alerts.message(pick, {**moved, 'from': 2.5, 'to': 1.5})['body'], 'Your Aaron Judge 1.5 Total Bases is back to 1.5.')
        pulled = alerts.message(pick, {**moved, 'kind': 'pulled', 'to': None})
        self.assertEqual((pulled['title'], pulled['body']), ('Line pulled', 'Your Aaron Judge 1.5 Total Bases was pulled from PrizePicks.'))
        self.assertEqual(pulled['tag'], message['tag'])  # the newer alert replaces the older


class NotifyTests(Base):
    def test_only_members_with_that_pick_are_told_and_goblins_only_of_a_pull(self):
        alerts.watch('uid-1', [{'sport': 'MLB', 'player': 'Aaron Judge', 'exportStat': 'Total Bases', 'line': 1.5, 'side': 'Over'}])
        alerts.watch('uid-2', [{'sport': 'MLB', 'player': 'Aaron Judge', 'exportStat': 'Total Bases', 'line': 0.5, 'modifier': 'goblin'},
                               {'sport': 'WNBA', 'player': "A'ja Wilson", 'betType': 'Points', 'line': 24.5}])
        alerts.watch('uid-3', [])
        self.assertEqual(set(self.kv.data[alerts.WATCH_KEY]), {'uid-1', 'uid-2'})
        with patch.object(push, 'deliver', return_value={'sent': 1}) as deliver:
            self.look([line('Aaron Judge', 'Total Bases', 1.5)], T0)
            self.look([line('Aaron Judge', 'Total Bases', 2.5)], T0 + 120)
        sent = deliver.call_args.args[0]
        self.assertEqual(list(sent), ['uid-1'])
        self.assertEqual(sent['uid-1'][0]['body'], 'Your Aaron Judge 1.5 Total Bases just moved to 2.5.')
        with patch.object(push, 'deliver', return_value={'sent': 2}) as deliver:
            self.look([line('Other', 'Hits', 0.5)], T0 + 240)  # gone once
            self.look([line('Other', 'Hits', 0.5)], T0 + 360)  # still gone: pulled
        self.assertEqual(sorted(deliver.call_args.args[0]), ['uid-1', 'uid-2'])
        self.assertEqual({message['title'] for messages in deliver.call_args.args[0].values() for message in messages}, {'Line pulled'})

    def test_book_moves_and_nobody_watching_send_nothing(self):
        with patch.object(push, 'deliver') as deliver:
            self.assertEqual(alerts.notify([{'sport': 'mlb', 'kind': 'line', 'app': 'draftkings', 'player': 'A', 'stat': 'Hits'}]), {})
            self.assertEqual(alerts.notify([{'sport': 'mlb', 'kind': 'line', 'app': 'prizepicks', 'player': 'A', 'stat': 'Hits'}]), {})
        deliver.assert_not_called()

    def test_a_local_run_never_writes_picks(self):
        env = {key: value for key, value in os.environ.items() if key not in ('VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'LINE_MOVES')}
        with patch.dict(os.environ, env, clear=True):
            alerts.watch('uid-1', [{'player': 'A', 'betType': 'Hits', 'line': 0.5}])
        self.assertNotIn(alerts.WATCH_KEY, self.kv.data)

    def test_deliver_sends_each_member_their_own(self):
        from test_push_notices import phone
        devices = {}
        for name, account in (('mine', 'uid-1'), ('also-mine', 'uid-1'), ('theirs', 'uid-2'), ('nobody', 'uid-3')):
            _, _, subscription = phone()
            devices[name] = subscription
            push.subscribe(account, subscription)
        sent = []

        def send_one(subscription, payload, subject):
            sent.append((subscription['endpoint'], json.loads(payload)['body'], subject))
            return 410 if subscription is devices['also-mine'] or subscription['endpoint'] == devices['also-mine']['endpoint'] else 201
        with patch.object(push, 'send_one', send_one), patch.object(push, 'vapid_keys'):
            result = push.deliver({'uid-1': [{'title': 't', 'body': 'one', 'url': '/', 'tag': 'x'}],
                                   'uid-2': [{'title': 't', 'body': 'two', 'url': '/', 'tag': 'y'}]}, subject='https://site')
        self.assertEqual(result, {'sent': 2, 'removed': 1, 'failed': 0})
        self.assertEqual(sorted((body for _, body, _ in sent)), ['one', 'one', 'two'])
        self.assertEqual(push.status()['devices'], 3)

    def test_automatic_alerts_sign_as_the_site(self):
        from test_push_notices import phone
        _, _, subscription = phone()
        push.subscribe('uid-1', subscription, site='https://krazydata.example')
        push.subscribe('uid-1', subscription, site='javascript:alert(1)')
        with patch.dict(os.environ, {'VAPID_SUBJECT': ''}):
            self.assertEqual(push.site_subject(), 'https://krazydata.example')


class RouteTests(Base):
    def session(self, body, account={'id': 'uid-1'}):
        from api.session import handler
        request = object.__new__(handler)
        raw = json.dumps(body).encode()
        request.path = '/api/session'
        request.headers = {'Content-Length': str(len(raw)), 'Origin': 'https://site.test', 'Host': 'site.test'}
        request.rfile = io.BytesIO(raw)
        with patch.object(accounts, 'identity', return_value=account), patch.object(request, '_json') as send:
            request.do_POST()
        return send.call_args.args[:2]

    def test_saving_picks_and_turning_alerts_on_keep_the_watch_list(self):
        import account_profile
        slip = [{'sport': 'MLB', 'player': 'Aaron Judge', 'exportStat': 'Total Bases', 'line': 1.5}]
        stored = {}
        with patch.object(account_profile.store, 'get', side_effect=lambda key, **_: stored.get(key)), \
                patch.object(account_profile.store, 'set', side_effect=lambda key, value, **_: stored.update({key: value}) or True):
            status, _ = self.session({'action': 'prefs-save', 'changes': {'slip': {'value': slip, 'at': 5}}}, {'id': 'a' * 8 + '-0000-0000-0000-' + 'b' * 12})
            self.assertEqual(status, 200)
            self.assertIn('a' * 8 + '-0000-0000-0000-' + 'b' * 12, self.kv.data.get(alerts.WATCH_KEY, {}))
            # A member who saved picks before alerts existed is picked up
            # when they turn alerts on.
            self.kv.data.pop(alerts.WATCH_KEY)
            from test_push_notices import phone
            _, _, device = phone()
            status, _ = self.session({'action': 'push-subscribe', 'subscription': device}, {'id': 'a' * 8 + '-0000-0000-0000-' + 'b' * 12})
        self.assertEqual(status, 200)
        self.assertIn('a' * 8 + '-0000-0000-0000-' + 'b' * 12, self.kv.data[alerts.WATCH_KEY])
        self.assertEqual(self.kv.data[push.SITE_KEY], 'https://site.test')

    def admin(self, query, headers=None, admin=True):
        from test_site_members import load_admin_handler
        handler = load_admin_handler()
        request = object.__new__(handler)
        request.path = '/api/v2-admin' + query
        request.headers = headers or {}
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=admin), patch.object(request, '_send') as send:
            request.do_GET()
        return send.call_args.args

    def test_the_timer_link_checks_every_league_and_needs_its_key(self):
        status, body = self.admin('?action=announce-status')
        self.assertEqual(status, 200)
        path = body['timer']['path']
        key = path.split('key=')[1]
        self.assertEqual(len(key), 32)
        self.assertEqual(self.admin('?action=announce-status', admin=False)[0], 401)
        with patch.object(moves, 'keep_fresh') as fresh:
            self.assertEqual(self.admin('?action=moves-tick')[0], 401)
            self.assertEqual(self.admin('?action=moves-tick&key=wrong')[0], 401)
            status, body = self.admin(f'?action=moves-tick&key={key}')
            self.assertEqual(status, 200)
            self.assertEqual(fresh.call_args.args[0], set(moves.SPORTS))
            with patch.dict(os.environ, {'CRON_SECRET': 'shh'}):
                self.assertEqual(self.admin('?action=moves-tick', {'Authorization': 'Bearer shh'})[0], 200)
        self.assertEqual(fresh.call_count, 2)


if __name__ == '__main__':
    unittest.main()
