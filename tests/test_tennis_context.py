import unittest
from unittest.mock import patch
from tennis_context import normalize_profile,inline_stats,same,archive_rows,refresh_player
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
        self.assertEqual(a['opponentValues']['aces'],2)
        self.assertEqual(b['opponentValues']['aces'],12)

    def test_archive_id_and_stat_alias(self):
        match={'id':42,'date':'2026-09-29T20:00:00Z','result':'6-4 6-3','player1Id':1,'player2Id':2,'player1':{'id':1,'name':'One'},'player2':{'id':2,'name':'Two','currentRank':10,'plays':'Left-handed'},'tournament':{'id':3},'odd2':3,'stat':{'player1':{'aces':5},'player2':{'aces':2}}}
        a,b=archive_rows([match],'atp')
        self.assertEqual(a['values']['aces'],5)
        self.assertEqual(a['opponentValues']['aces'],2)
        self.assertEqual(a['opponentRank'],10)
        self.assertEqual(a['opponentHand'],'Left')
        self.assertEqual(a['opponentOdds'],3)
        self.assertEqual(archive_rows([{**match,'result':'6-4 2-1 RET'}],'atp'),[])

    def test_partial_refresh_keeps_previously_reported_stats(self):
        old={'gameId':'one','date':'2026-09-01','opponentRank':10,'values':{'aces':5,'doublefaults':2},'opponentValues':{'aces':3}}
        new={'gameId':'one','date':'2026-09-01','playerId':'1','opponentRank':None,'values':{'aces':6},'opponentValues':{}}
        def cached(key,*args):return {'data':{'id':1,'name':'One'}} if key.startswith('profile:') else {'data':[]}
        with patch('tennis_context.cached',side_effect=cached),patch('tennis_context.archive_rows',return_value=[new]),patch('tennis_context.read',return_value={'games':[old]}),patch('tennis_context.write') as write:
            refresh_player({'id':1,'name':'One'},'atp')
        saved=write.call_args_list[0].args[1]['games'][0]
        self.assertEqual(saved['values'],{'aces':6,'doublefaults':2})
        self.assertEqual(saved['opponentValues'],{'aces':3})
        self.assertEqual(saved['opponentRank'],10)

    def test_same_day_history_merge_preserves_fields_without_crashing(self):
        old={'gameId':'old','date':'2026-09-29T12:00Z','opponent':'Ruud C.','values':{'aces':3,'doublefaults':2}}
        new={'gameId':'new','date':'2026-09-29T13:00Z','opponent':'Casper Ruud','values':{'aces':4}}
        with patch('tennis_history.snapshot_history',return_value={'games':[old],'updatedAt':0}),patch('tennis_live.player_history',return_value={'games':[new],'updatedAt':1}),patch('tennis_live.tick'):
            result=history('Test Player')
        self.assertEqual(len(result['games']),1)
        self.assertEqual(result['games'][0]['values'],{'aces':4,'doublefaults':2})
