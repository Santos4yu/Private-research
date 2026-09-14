"""Explicit mock providers only: route isolation and safe source failures."""
import json
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
from backend.sports.nfl.domain import NFLPlayer, NFLPosition, DataStatus
from backend.sports.nfl.services.base import ProviderResult
from backend.sports.nfl.matchup_service import matchup


class MatchupServiceTests(unittest.TestCase):
    def request(self, query, result=None, error=None):
        from api.nfl import handler
        request=object.__new__(handler)
        request.headers={}; request.path='/api/nfl/matchup?'+query
        with patch('site_controls.read',return_value={'maintenance':False,'disabledTabs':[],'requireLogin':False}),patch('api.nfl.session_with_live_access',return_value=True), patch('api.nfl.send_json') as send, patch('backend.sports.nfl.matchup_service.matchup',return_value=result,side_effect=error) as engine:
            request.do_GET()
            return send.call_args.args[1:], engine.call_args

    def test_single_handler_dispatch(self):
        output, called=self.request('season=2025&week=8&playerId=mock-qb&prop=passing_yards',{'status':'NOT_AVAILABLE'})
        self.assertEqual(output,(200,{'data':{'status':'NOT_AVAILABLE'}}))
        self.assertEqual(called.args,(2025,'mock-qb',8,'passing_yards'))

    def test_required_identity_and_regular_season(self):
        for query in ('season=2025','season=2025&week=8&playerId=x&prop=passing_yards&seasonType=SB'):
            output,called=self.request(query)
            self.assertEqual(output[0],400)
            self.assertIsNone(called)

    def test_source_failure_never_fabricates_score(self):
        output,_=self.request('season=2025&week=8&playerId=x&prop=passing_yards',error=RuntimeError('test-only failure'))
        self.assertEqual(output[0],503)
        self.assertNotIn('score',output[1])
        self.assertNotIn('test-only failure',json.dumps(output[1]))

    def test_invalid_prop_returns_client_error(self):
        output,_=self.request('season=2025&week=8&playerId=x&prop=receiving_yards',error=ValueError('test-only incompatible'))
        self.assertEqual(output[0],400)

    def test_unresolved_player_no_provider_or_zero_score(self):
        result=ProviderResult(DataStatus.MISSING,None,'mock-only',datetime.now(timezone.utc))
        with patch('backend.sports.nfl.matchup_service.nflverse.players',return_value=result),patch('backend.sports.nfl.matchup_service.season_data') as pbp:
            output=matchup(2025,'mock-unknown',8,'passing_yards')
            self.assertEqual(output['status'],'NOT_AVAILABLE')
            pbp.assert_not_called()
            self.assertNotIn('matchupQuality',output)

    def test_position_validation_before_advanced_requests(self):
        player=NFLPlayer(id='mock-qb',name='Mock QB',first_name='Mock',last_name='QB',position=NFLPosition.QB,team_id='MOCK',status='ACT')
        result=ProviderResult(DataStatus.AVAILABLE,[player],'mock-only',datetime.now(timezone.utc))
        with patch('backend.sports.nfl.matchup_service.nflverse.players',return_value=result),patch('backend.sports.nfl.matchup_service.season_data') as pbp:
            with self.assertRaises(ValueError):
                matchup(2025,'mock-qb',8,'receiving_yards')
            pbp.assert_not_called()

    def test_prop_switch_reuses_cached_context_without_refetching(self):
        # Regression test for the actual reported bug: switching the
        # selected stat on an already-open player used to re-run the
        # expensive season-wide data load (previously keyed by prop too),
        # even though nothing prop-specific happened until _build_result.
        from backend.sports.nfl.cache import clear_nfl_cache
        clear_nfl_cache()
        player=NFLPlayer(id='mock-qb',name='Mock QB',first_name='Mock',last_name='QB',position=NFLPosition.QB,team_id='MOCK',status='ACT')
        roster=ProviderResult(DataStatus.AVAILABLE,[player],'mock-only',datetime.now(timezone.utc))
        context={'status':'OK','week':8,'player':{'position':'QB','team_id':'MOCK'}}
        try:
            with patch('backend.sports.nfl.matchup_service.nflverse.players',return_value=roster), \
                 patch('backend.sports.nfl.matchup_service._load_context',return_value=context) as loader, \
                 patch('backend.sports.nfl.matchup_service._build_result',side_effect=lambda ctx,prop:{'prop':prop}) as builder:
                first=matchup(2025,'mock-qb',8,'passing_yards')
                second=matchup(2025,'mock-qb',8,'pass_completions')
            loader.assert_called_once()
            self.assertEqual(first,{'prop':'passing_yards'})
            self.assertEqual(second,{'prop':'pass_completions'})
        finally:
            clear_nfl_cache()
