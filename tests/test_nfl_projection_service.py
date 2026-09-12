"""Explicit mock adapters for source gates and the existing authenticated API."""
import unittest
from datetime import datetime,timezone
from unittest.mock import patch
from backend.sports.nfl.services.base import ProviderResult
from backend.sports.nfl.domain import DataStatus
from backend.sports.nfl.projections.service import _load
from backend.sports.nfl.projections.dataset import weekly_logs
from backend.sports.nfl.cache import clear_nfl_cache

class ProjectionServiceTests(unittest.TestCase):
    def request(self,query,error=None):
        from api.nfl import handler
        request=object.__new__(handler);request.headers={};request.path='/api/nfl/projection?'+query
        with patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send,patch('backend.sports.nfl.projections.service.projection',return_value={'status':'NOT_AVAILABLE'},side_effect=error) as engine:
            request.do_GET()
            return send.call_args.args[1:],engine.call_args

    def test_single_handler_route(self):
        output,called=self.request('season=2025&week=8&playerId=mock-qb&prop=passing_yards')
        self.assertEqual(output[0],200)
        self.assertEqual(called.args,(2025,'mock-qb',8,'passing_yards'))

    def test_no_market_side_input(self):
        base='season=2025&week=8&playerId=mock-qb&prop=passing_yards'
        for extra in ('line=250','side=OVER','under=true'):
            output,called=self.request(base+'&'+extra)
            self.assertEqual(output[0],400);self.assertIsNone(called)

    def test_missing_identity_regular_season(self):
        for query in ('season=2025','season=2025&week=8&playerId=x&prop=passing_yards&seasonType=SB'):
            output,called=self.request(query)
            self.assertEqual(output[0],400);self.assertIsNone(called)

    def test_provider_failure_no_number(self):
        output,_=self.request('season=2025&week=8&playerId=x&prop=passing_yards',RuntimeError('mock-only'))
        self.assertEqual(output[0],503);self.assertNotIn('projectionMean',output[1])

    def test_identity_unavailable_not_zero(self):
        result=ProviderResult(DataStatus.MISSING,None,'mock-only',datetime.now(timezone.utc))
        with patch('backend.sports.nfl.projections.service.nflverse.players',return_value=result):
            output=_load(2025,'mock-unknown',8,'passing_yards')
        self.assertEqual(output['status'],'NOT_AVAILABLE');self.assertIsNone(output['projectionMean'])

    def test_unsupported_model_does_not_download_statistics(self):
        from types import SimpleNamespace
        from backend.sports.nfl.domain import NFLPlayer,NFLPosition
        player=NFLPlayer(id='mock-qb',name='Mock QB',first_name='Mock',last_name='QB',status='ACT',position=NFLPosition.QB,team_id='KC')
        game=SimpleNamespace(id='mock-game',home_team=SimpleNamespace(id='KC'),away_team=SimpleNamespace(id='BUF'))
        with patch('backend.sports.nfl.projections.service.nflverse.players',return_value=SimpleNamespace(data=[player])),patch('backend.sports.nfl.projections.service.nflverse.schedule',return_value=SimpleNamespace(data=[game])),patch('backend.sports.nfl.projections.service.weekly_logs') as stats:
            output=_load(2025,'mock-qb',8,'passing_touchdowns')
            self.assertEqual(output['status'],'NOT_AVAILABLE');stats.assert_not_called()

    def row(self):
        from backend.sports.nfl.services.nflverse import PLAYER_STAT_FIELDS
        return {**{k:'0' for k in PLAYER_STAT_FIELDS},'season_type':'REG','season':'2025','week':'8','team':'KC','player_id':'mock-qb','game_id':'mock-game','position':'QB','air_yards_share':'-.1'}

    def test_negative_air_yards_not_invalid_count(self):
        clear_nfl_cache()
        with patch('backend.sports.nfl.projections.dataset._source_rows',return_value=([self.row()],datetime.now(timezone.utc),None)):
            output=weekly_logs(2025)
            self.assertEqual(output['logs'][0]['stats']['air_yards_share'],-.1)
        clear_nfl_cache()

    def test_missing_stat_and_invalid_count(self):
        row=self.row();row['passing_yards']=''
        clear_nfl_cache()
        with patch('backend.sports.nfl.projections.dataset._source_rows',return_value=([row],datetime.now(timezone.utc),None)):
            self.assertIsNone(weekly_logs(2025)['logs'][0]['stats']['passing_yards'])
        clear_nfl_cache();row['attempts']='-1'
        with patch('backend.sports.nfl.projections.dataset._source_rows',return_value=([row],datetime.now(timezone.utc),None)):
            with self.assertRaises(RuntimeError):weekly_logs(2025)
        clear_nfl_cache()
