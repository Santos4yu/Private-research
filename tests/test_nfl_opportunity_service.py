"""Explicit mock provider fixtures; no synthetic data is shipped to production."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from backend.sports.nfl.domain import NFLPlayer, NFLPosition, NFLGame, NFLTeamRef, NFLDepthChartEntry, DataStatus
from backend.sports.nfl.services.base import ProviderResult
from backend.sports.nfl.opportunity_service import _load


class OpportunityServiceTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime.now(timezone.utc)
        self.roster=[NFLPlayer(id='mock-qb',name='Mock QB',first_name='Mock',last_name='QB',status='ACT',position=NFLPosition.QB,team_id='MOCK',source_ids={'pfr_id':'mock-qb'}),
                     NFLPlayer(id='mock-wr',name='Mock WR',first_name='Mock',last_name='WR',status='ACT',position=NFLPosition.WR,team_id='MOCK',source_ids={'pfr_id':'mock-wr'})]
        self.game=NFLGame(id='mock-game',season=2025,season_type='REG',week=8,starts_at=self.now+timedelta(hours=2),status='SCHEDULED',home_team=NFLTeamRef('MOCK','MOCK','Mock'),away_team=NFLTeamRef('OTHER','OTHER','Other'))
        self.teams=[{'game_id':str(w),'week':w,'team_id':'MOCK','opponent_team_id':'OTHER','stats':{'offensive_plays':65,'dropbacks':40,'called_rushes':25,'spikes':0,'scrambles':3,'sacks_suffered':2,'attempts':35,'carries':28,'drives':10}} for w in range(1,8)]
        self.raw=[{'player_id':p.id,'position':p.position.value,'game_id':str(w),'week':str(w),'season_type':'REG','team':'MOCK','targets':'7' if p.position==NFLPosition.WR else '0','carries':'0','attempts':'35' if p.position==NFLPosition.QB else '0'} for p in self.roster for w in range(1,8)]

    def result(self,data,status=DataStatus.AVAILABLE):
        return ProviderResult(status,data,'mock-provider',self.now)

    def load(self,injuries=None):
        depth=NFLDepthChartEntry(team_id='MOCK',player_id='mock-qb',player_name='Mock QB',position='QB',role='QB',rank=1,updated_at=self.now-timedelta(hours=1),source='mock-provider')
        pbp={'teams':self.teams,'players':[],'fetchedAt':self.now.isoformat()}
        with patch('backend.sports.nfl.opportunity_service.source.players',return_value=self.result(self.roster)), \
             patch('backend.sports.nfl.opportunity_service.source.schedule',return_value=self.result([self.game])), \
             patch('backend.sports.nfl.opportunity_service._optional_pbp',return_value=(pbp,None)), \
             patch('backend.sports.nfl.opportunity_service.source._source_rows',return_value=(self.raw,self.now,None)), \
             patch('backend.sports.nfl.opportunity_service.source.injuries',return_value=injuries or self.result(None,DataStatus.MISSING)), \
             patch('backend.sports.nfl.opportunity_service.source.snap_counts',return_value=self.result([])), \
             patch('backend.sports.nfl.opportunity_service.source.depth_chart',return_value=self.result([depth])):
            return _load(2025,'mock-wr',8)

    def test_missing_injury_feed_does_not_become_confident(self):
        output=self.load()
        self.assertEqual(output['status'],'LOW_CONFIDENCE')
        self.assertEqual(output['health']['injuryCertainty'],'UNKNOWN')
        self.assertIsNotNone(output['player']['metrics']['expectedTargets']['mean'])

    def test_uncertain_injury_exposes_conditional_scenarios_without_probability(self):
        injury=SimpleNamespace(player_id='mock-wr',game_status='QUESTIONABLE',season=2025,week=8)
        output=self.load(self.result([injury]))
        self.assertEqual(output['status'],'NOT_AVAILABLE')
        self.assertEqual(output['player']['metrics'],{})
        self.assertEqual(len(output['scenarios']),2)
        self.assertTrue(all(s['probability'] is None for s in output['scenarios']))
        self.assertIsNotNone(output['scenarios'][0]['player']['metrics']['expectedTargets']['mean'])

    def test_team_and_roster_reconcile(self):
        output=self.load()
        for row in output['allocation'].values():
            self.assertLessEqual(row['assigned'],row['capacity']+1e-8)

    def test_no_prior_season_sample_fails(self):
        self.teams=[{**r,'week':8} for r in self.teams]
        output=self.load()
        self.assertEqual(output['status'],'NOT_AVAILABLE')
        self.assertNotIn('player',output)

    def test_opportunity_route_requires_forecast_identity(self):
        from api.nfl import handler
        request=object.__new__(handler)
        request.headers={}
        request.path='/api/nfl/opportunity?season=2025'
        with patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send:
            request.do_GET()
            self.assertEqual(send.call_args.args[1],400)

    def test_opportunity_route_uses_existing_single_handler(self):
        from api.nfl import handler
        request=object.__new__(handler); request.headers={}
        request.path='/api/nfl/opportunity?season=2025&week=8&playerId=mock-wr'
        with patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send,patch('backend.sports.nfl.opportunity_service.opportunity',return_value={'status':'NOT_AVAILABLE'}) as engine:
            request.do_GET()
            engine.assert_called_once_with(2025,'mock-wr',8)
            self.assertEqual(send.call_args.args[1],200)

    def test_opportunity_route_does_not_mix_postseason_data(self):
        from api.nfl import handler
        request=object.__new__(handler); request.headers={}
        request.path='/api/nfl/opportunity?season=2025&week=8&playerId=mock-wr&seasonType=SB'
        with patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send:
            request.do_GET()
            self.assertEqual(send.call_args.args[1],400)

if __name__=='__main__':
    unittest.main()
