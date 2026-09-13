"""Explicit synthetic fixtures for descriptive research; no live model values."""
import unittest
from types import SimpleNamespace
from dataclasses import dataclass
from backend.sports.nfl.services.research_stats import prizepicks_fantasy,FANTASY_WEIGHTS,with_reception_lengths

@dataclass
class MockLog:
    game_id: str
    player_id: str
    stats: dict

class NFLResearchStatsTests(unittest.TestCase):
    def test_prizepicks_scoring_all_components(self):
        row={key:0 for key in FANTASY_WEIGHTS};row.update(fumble_recovery_tds=0,def_tds=0)
        row.update(passing_yards=250,passing_tds=2,passing_interceptions=1,rushing_yards=20,rushing_tds=1,receiving_yards=10,receptions=2,receiving_tds=1,fumbles_lost_total=1,passing_2pt_conversions=1,special_teams_tds=1)
        self.assertEqual(prizepicks_fantasy(row),41)
    def test_missing_nan_and_ambiguous_recovery_never_zero(self):
        row={key:0 for key in FANTASY_WEIGHTS};row.update(fumble_recovery_tds=0,def_tds=0)
        self.assertEqual(prizepicks_fantasy(row),0)
        for value in (None,'',float('nan')):
            self.assertIsNone(prizepicks_fantasy({**row,'passing_yards':value}))
        self.assertEqual(prizepicks_fantasy({**row,'fumble_recovery_tds':1}),6)
        self.assertIsNone(prizepicks_fantasy({**row,'fumble_recovery_tds':1,'special_teams_tds':1}))
        self.assertIsNone(prizepicks_fantasy({**row,'receptions':-1}))
    def test_longest_is_maximum_reconciled_reception_not_average(self):
        log=MockLog('mock-game','mock-player',{'receptions':3,'receiving_yards':40})
        player={'game_id':log.game_id,'player_id':log.player_id,'receptionDetails':{'count':3,'complete':True,'lengths':[5,30,5]}}
        self.assertEqual(with_reception_lengths([log],[player])[0].stats['longest_reception'],30)
        self.assertNotIn('longest_reception',log.stats)
        player['receptionDetails']['count']=2
        self.assertIsNone(with_reception_lengths([log],[player])[0].stats['longest_reception'])
    def test_zero_receptions_is_known_zero_missing_pbp_is_not(self):
        logs=[MockLog('zero','mock',{'receptions':0,'receiving_yards':0}),MockLog('missing','mock',{'receptions':1,'receiving_yards':9})]
        self.assertEqual([row.stats['longest_reception'] for row in with_reception_lengths(logs,[])],[0,None])

    def test_reception_aggregation_uses_credited_yards_and_rejects_lateral_ambiguity(self):
        from backend.sports.nfl.services.matchup_data import aggregate
        base={'game_id':'mock','week':'1','season_type':'REG','posteam':'PIT','defteam':'ATL','play_type':'pass','play_deleted':'0','two_point_attempt':'0','qb_dropback':'1','qb_scramble':'0','sack':'0','pass_attempt':'1','rush_attempt':'0','complete_pass':'1','yards_gained':'8','receiving_yards':'8','passer_player_id':'mock-qb','receiver_player_id':'mock-wr'}
        data=aggregate([base,{**base,'receiving_yards':'20','yards_gained':'20'}])
        detail=next(p for p in data['players'] if p['player_id']=='mock-wr')['receptionDetails']
        self.assertEqual(detail,{'count':2,'complete':True,'lengths':[8,20]})
        lateral=aggregate([{**base,'lateral_receiver_player_id':'another-mock'}])
        self.assertFalse(next(p for p in lateral['players'] if p['player_id']=='mock-wr')['receptionDetails']['complete'])

    def test_reception_endpoint_dispatch_is_isolated(self):
        from api.nfl import handler
        from unittest.mock import patch
        from backend.sports.nfl.services.base import ProviderResult
        from backend.sports.nfl.domain import DataStatus
        from datetime import datetime,timezone
        request=object.__new__(handler);request.headers={};request.path='/api/nfl/reception-logs?season=2025&playerId=mock-player'
        result=ProviderResult(DataStatus.AVAILABLE,[],'mock-only',datetime.now(timezone.utc))
        with patch('site_controls.read',return_value={'maintenance':False,'disabledTabs':[],'requireLogin':False}),patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send,patch('backend.sports.nfl.services.research_stats.reception_logs',return_value=result) as service:
            request.do_GET();self.assertEqual(send.call_args.args[1],200);service.assert_called_once_with(2025,'mock-player')
