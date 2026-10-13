import json
import time
import unittest
from unittest.mock import patch

import site_health as health


class FakeStore:
    """The few storage commands site_health uses, in memory."""
    def __init__(self):
        self.data, self.lists = {}, {}

    def get(self, key, **_):
        return self.data.get(key)

    def pipeline(self, commands):
        out = []
        for command in commands:
            op, key = command[0], command[1]
            if op == 'SET':
                if 'NX' in command and key in self.data:
                    out.append({'result': None}); continue
                self.data[key] = command[2]; out.append({'result': 'OK'})
            elif op == 'LPUSH':
                self.lists.setdefault(key, []).insert(0, command[2]); out.append({'result': len(self.lists[key])})
            elif op == 'LTRIM':
                self.lists[key] = self.lists.get(key, [])[command[2]:command[3] + 1]; out.append({'result': 'OK'})
            elif op == 'LRANGE':
                out.append({'result': self.lists.get(key, [])[command[2]:command[3] + 1]})
        return out


class SiteHealthTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patch.object(health, '_store', return_value=self.store).start()
        self.sent = []
        patch.object(health, '_discord', side_effect=lambda title, detail: self.sent.append(title) or True).start()
        health._light['at'] = 0.0
        self.addCleanup(patch.stopall)

    def test_one_kind_of_problem_is_sent_once_until_it_goes_quiet(self):
        self.assertTrue(health.alert('x', 'Broke', 'details'))
        self.assertFalse(health.alert('x', 'Broke', 'details'))
        self.assertTrue(health.alert('y', 'Other', 'details'))
        self.assertEqual(self.sent, ['Broke', 'Other'])
        self.assertEqual([item['title'] for item in health.recent()], ['Other', 'Broke'])

    def test_stopped_line_checks_are_reported_and_running_ones_are_not(self):
        fresh = {'nfl': time.time() - 120}
        with patch('line_moves.checked', return_value=fresh):
            health.light_check()
        self.assertEqual(self.sent, [])
        health._light['at'] = 0.0
        stale = {'nfl': '2020-01-01T00:00:00+00:00', 'mlb': time.time() - 3 * 3600}
        with patch('line_moves.checked', return_value=stale):
            health.light_check()
        self.assertEqual(self.sent, ['Line checks stopped'])

    def test_the_daily_check_settles_results_and_flags_missed_whop_messages(self):
        import slip_ledger
        import whop_billing
        with patch('line_moves.checked', return_value={'nfl': time.time()}), \
             patch.object(slip_ledger, 'tick', return_value={'settled': 3}) as tick, \
             patch.object(whop_billing, 'configured', return_value=True), \
             patch.object(whop_billing, 'subscribers', return_value={'counts': {'total': 4}, 'repaired': 2}) as sync:
            report = health.daily()
        tick.assert_called_once_with(limit=40)
        sync.assert_called_once_with(sync=True)
        self.assertEqual(report['whop'], {'members': 4, 'repaired': 2})
        self.assertEqual(self.sent, ['Whop messages were missed'])


if __name__ == '__main__':
    unittest.main()
