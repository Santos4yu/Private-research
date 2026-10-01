import json
import unittest
from unittest.mock import patch
import finder_history_store as cache

class SharedHistoryTests(unittest.TestCase):
    def test_success_is_atomic_and_outage_cannot_erase_sample(self):
        payload={'rows':[{'gameId':'1'}]}
        with patch.object(cache,'command') as command:
            self.assertIs(cache.remember('wnba','wnba:1:2026',payload,{'playerId':'1'}),payload)
            self.assertEqual(command.call_args.args[:3],('HSET','finder:history:v1:wnba','wnba:1:2026'))
            command.reset_mock()
            for invalid in ({'rows':[]},{'error':'outage'},{'games':[1],'complete':False}):
                cache.remember('wnba','key',invalid,{})
            command.assert_not_called()

    def test_snapshot_excludes_expired_and_private_loader_arguments(self):
        with patch.object(cache.time,'time',return_value=100000),patch.object(cache,'command',return_value=['fresh',json.dumps({'at':99999000,'payload':{'rows':[1]},'args':{'playerId':'1'}}),'old',json.dumps({'at':1,'payload':{'rows':[2]}})]):
            result=cache.snapshot('wnba')
            self.assertEqual(list(result['histories']),['fresh'])
            self.assertNotIn('args',result['histories']['fresh'])

    def test_invalid_sport_rejected(self):
        with self.assertRaises(ValueError):cache.snapshot('unknown')

    def test_board_enrollment_deduplicates_player_markets(self):
        with patch.object(cache,'command') as command:
            board={'rows':[{'playerId':'1'},{'playerId':'1'}]}
            cache.enroll_basketball('nba',board)
            self.assertEqual(len(command.call_args.args),4)

if __name__=='__main__':unittest.main()
