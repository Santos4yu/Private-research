"""The Props tab's track record (props_record.py): pure, with a fake KV."""
import json
import unittest
from datetime import datetime, timezone

import props_record
from backend.sports.wnba import context
from backend.sports.wnba.league import FIELDS


class FakeKV:
    def __init__(self):
        self.hashes = {}

    def __call__(self, commands, timeout=4):
        out = []
        for command in commands:
            if command[0] == 'HSET':
                fields = self.hashes.setdefault(command[1], {})
                fields.update(dict(zip(command[2::2], command[3::2])))
                out.append(len(command[2:]) // 2)
            elif command[0] == 'HGETALL':
                out.append([part for item in self.hashes.get(command[1], {}).items() for part in item])
            else:
                out.append(1)
        return out


def stamp(text):
    return datetime.fromisoformat(text).replace(tzinfo=timezone.utc).timestamp()


def box(pid, minutes, **values):
    row = [pid, 1] + [0] * len(FIELDS)
    row[2 + FIELDS.index('min')] = minutes
    for name, value in values.items():
        row[2 + FIELDS.index(name)] = value
    return row


class RecordTests(unittest.TestCase):
    def test_keeps_the_last_report_before_each_game(self):
        kv, now = FakeKV(), stamp('2026-11-03T18:00:00')
        rows = [{'id': '3975', 'market': 'player_points', 'line': 24.5, 'start': '2026-11-04T00:30:00Z', 'score': 81.4, 'chance': 0.5612,
                 'tier': 'strong', 'modifier': 'standard', 'needs': 0.5},
                # Started already, an unknown stat, no player id: not kept.
                {'id': '1', 'market': 'player_points', 'line': 10.5, 'start': '2026-11-03T17:00:00Z', 'score': 60},
                {'id': '2', 'market': 'player_dunks', 'line': 1.5, 'start': '2026-11-04T00:30:00Z', 'score': 60},
                {'id': 'x', 'market': 'player_points', 'line': 1.5, 'start': '2026-11-04T00:30:00Z', 'score': 60}]
        self.assertEqual(props_record.remember(rows, kv, now=now), 1)
        # A 7:30 pm Eastern tip on the 3rd is the 3rd's game (00:30 UTC on the 4th).
        kept = kv.hashes['krazy:props-record:v1:nba:2026-11-03']
        self.assertEqual(json.loads(kept['3975|player_points|24.5']), [81, 0.561, 'strong', 'standard', 0.5])
        rows[0]['score'] = 77
        props_record.remember(rows, kv, now=now)
        self.assertEqual(json.loads(kept['3975|player_points|24.5'])[0], 77)

    def test_record_by_band_and_tier(self):
        kv = FakeKV()
        kv.hashes['krazy:props-record:v1:nba:2026-11-03'] = {
            '1|player_points|20.5': json.dumps([92, 0.6, 'elite', 'standard', 0.5]),      # 25: over
            '2|player_points|18.5': json.dumps([80, 0.55, 'strong', 'standard', 0.5]),    # 15: under
            '3|player_rebounds|8': json.dumps([45, 0.5, 'lean', 'standard', 0.5]),        # 8: push
            '4|player_points_rebounds|30.5': json.dumps([30, 0.4, 'fade', 'standard', 0.5]),  # 20 + 12: over
            '5|player_points|10.5': json.dumps([70, 0.5, None, 'demon', 0.35]),            # didn't play: not counted
        }
        kv.hashes['krazy:props-record:v1:nba:2026-11-04'] = {'1|player_points|20.5': json.dumps([95, 0.6, 'elite', 'standard', 0.5])}
        payload = {'games': {'g1': {'date': '2026-11-04T00:30Z', 't': {
            'AAA': {'p': [box('1', 34, pts=25), box('2', 30, pts=15), box('3', 28, reb=8)]},
            'BBB': {'p': [box('4', 31, pts=20, reb=12), box('5', 0)]}}}}}
        found = props_record.record(['2026-11-03', '2026-11-04'], kv, [payload], context.stat_value, today='2026-11-04')
        # The 4th is today: not read yet.
        self.assertEqual((found['days'], found['nights']), (1, 1))
        bands = {item['band']: item for item in found['bands']}
        self.assertEqual((bands['90+']['over'], bands['90+']['overRate']), (1, 100.0))
        self.assertEqual((bands['75-89']['under'], bands['75-89']['overRate']), (1, 0.0))
        # A push counts as a prop, not in the rate.
        self.assertEqual((bands['40-59']['push'], bands['40-59']['props'], bands['40-59']['overRate']), (1, 1, None))
        self.assertEqual(bands['Under 40']['over'], 1)
        tiers = {item['tier']: item for item in found['tiers']}
        self.assertEqual((tiers['elite']['over'], tiers['fade']['over'], tiers['strong']['under']), (1, 1, 1))
        self.assertEqual(found['all'], {'over': 2, 'under': 1, 'push': 1, 'props': 4, 'overRate': 66.7})

    def test_nothing_kept_reads_empty(self):
        found = props_record.record(['2026-11-01'], FakeKV(), [], context.stat_value, today='2026-11-04')
        self.assertEqual((found['nights'], found['all']['props']), (0, 0))


if __name__ == '__main__':
    unittest.main()
