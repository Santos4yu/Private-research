import unittest
from unittest.mock import patch
from tennis_context import normalize_profile,inline_stats,same
from tennis_live import parse_result
from tennis_history import history

class ContextTests(unittest.TestCase):
    def test_profile_fields_and_provider_alias(self):
        p=normalize_profile({'id':1,'name':'Test','birthday':'2000-01-01T00:00:00Z','currentRank':14,'progress':-2,'information':{'height':'183','plays':'Left-Handed, Two-Handed Backhand'}})
        self.assertEqual(p['hand'],'Left');self.assertEqual(p['rank'],14);self.assertEqual(p['heightCm'],'183')
        self.assertTrue(same('Daniel Vallejo','Adolfo Daniel Vallejo'))

    def test_inline_serve_break_and_hold_statistics(self):
        match={'matchId':'42','date':'2026-09-29T20:00:00Z','result':'4-6 6-2 7-6(8)','result_type':'completed','player1Id':1,'player2Id':2,'player1':{'id':1,'name':'One'},'player2':{'id':2,'name':'Two'},'tournament':{'id':3},'stats':{'player1':{'firstServe':60,'firstServeOf':100,'winningOnFirstServe':45,'winningOnSecondServe':20,'aces':12,'doubleFaults':4,'breakPointsConverted':4,'breakPointsConvertedOf':16},'player2':{'firstServe':60,'firstServeOf':100,'winningOnFirstServe':40,'winningOnSecondServe':20,'aces':2,'doubleFaults':1,'breakPointsConverted':3,'breakPointsConvertedOf':9}}}
        a,b=parse_result(match,'atp',inline_stats(match))
        self.assertEqual(a['values']['holdpercentage'],80)
        self.assertEqual(a['values']['doublefaultpercentage'],10)
        self.assertEqual(a['values']['secondservepercentage'],90)
        self.assertEqual(a['values']['returnpointswonpercentage'],40)
        self.assertAlmostEqual(a['values']['dominanceratio'],40/35)
        self.assertEqual(a['values']['breakpointsgivenup'],3)
        self.assertEqual(a['values']['breakpointssaved'],6)

    def test_same_day_history_merge_preserves_fields_without_crashing(self):
        old={'gameId':'old','date':'2026-09-29T12:00Z','opponent':'Ruud C.','values':{'aces':3,'doublefaults':2}}
        new={'gameId':'new','date':'2026-09-29T13:00Z','opponent':'Casper Ruud','values':{'aces':4}}
        with patch('tennis_history.snapshot_history',return_value={'games':[old],'updatedAt':0}),patch('tennis_live.player_history',return_value={'games':[new],'updatedAt':1}),patch('tennis_live.tick'):
            result=history('Test Player')
        self.assertEqual(len(result['games']),1)
        self.assertEqual(result['games'][0]['values'],{'aces':4,'doublefaults':2})
