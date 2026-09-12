"""Mock provider payloads are test-only; never production research."""
import unittest
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import patch
from types import SimpleNamespace
from backend.sports.nfl.services import odds
from backend.sports.nfl.domain import NFLPlayer, NFLPosition

class NFLOddsTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,9,12,tzinfo=timezone.utc)
        self.event={'eventId':'test-event','gameId':'test-game','startsAt':'2026-09-13T17:00:00+00:00','homeTeamId':'PIT','awayTeamId':'ATL','week':1}
        self.player=NFLPlayer('test-player','Mock Quarterback',NFLPosition.QB,'PIT','Mock','Quarterback','ACT')
        self.payload={'id':'test-event','commence_time':self.event['startsAt'],'bookmakers':[{'key':'prizepicks','title':'PrizePicks','last_update':self.now.isoformat(),'markets':[{'key':'player_pass_yds','outcomes':[{'name':'Over','description':self.player.name,'point':200.5,'price':-110}]}]}]}
    def run_payload(self,payload=None,players=None):
        return odds.normalize(payload or self.payload,self.event,players or [self.player],self.now)
    def test_real_contract_identity_and_zero_line(self):
        self.payload['bookmakers'][0]['markets'][0]['outcomes'][0]['point']=0
        line=self.run_payload()['data'][0]['line']
        self.assertTrue(line['verified']);self.assertEqual(line['value'],0)
        self.assertEqual(line['playerId'],'test-player');self.assertEqual(line['gameId'],'test-game')
    def test_missing_point_never_becomes_zero(self):
        del self.payload['bookmakers'][0]['markets'][0]['outcomes'][0]['point']
        self.assertEqual(self.run_payload()['data'],[])
    def test_unknown_and_ambiguous_names_not_fuzzy_matched(self):
        duplicate=NFLPlayer('other',self.player.name,NFLPosition.QB,'ATL','Mock','Quarterback','ACT')
        self.assertEqual(self.run_payload(players=[self.player,duplicate])['data'],[])
        self.payload['bookmakers'][0]['markets'][0]['outcomes'][0]['description']='Unknown Person'
        self.assertEqual(self.run_payload()['unresolvedPlayers'],1)
    def test_position_and_team_gates(self):
        self.payload['bookmakers'][0]['markets'][0]['key']='player_reception_longest'
        self.assertEqual(self.run_payload()['data'],[])
        offteam=NFLPlayer('other',self.player.name,NFLPosition.QB,'KC','Mock','Quarterback','ACT')
        self.assertEqual(self.run_payload(players=[offteam])['data'],[])
    def test_event_and_kickoff_mismatch_rejected(self):
        for field in ('id','commence_time'):
            payload=deepcopy(self.payload);payload[field]='wrong'
            with self.assertRaises(ValueError):self.run_payload(payload)
    def test_alternates_and_malformed_outcomes_ignored(self):
        self.payload['bookmakers'][0]['markets']=[None,{'key':'player_pass_yds_alternate','outcomes':[]},{'key':'player_pass_yds','outcomes':[None,{}]}]
        self.assertEqual(self.run_payload()['data'],[])
    def test_future_and_missing_timestamps_rejected_stale_labelled(self):
        book=self.payload['bookmakers'][0]
        for time in ('2026-09-13T00:00:00Z',None):
            book['last_update']=time;self.assertEqual(self.run_payload()['data'],[])
        book['last_update']='2026-09-11T23:00:00Z'
        self.assertTrue(self.run_payload()['data'][0]['line']['stale'])
    def test_insufficient_successful_free_response_tries_next_key(self):
        def response(remaining,status=200):return SimpleNamespace(status_code=status,ok=status==200,headers={'x-requests-remaining':str(remaining)})
        with patch.object(odds,'credentials',return_value=['test-exhausted','test-two','test-working']),patch.object(odds._session,'get',side_effect=[response(0),response(2),response(90000)]) as get:
            self.assertEqual(odds._get('/sports/americanfootball_nfl/events',{}).headers['x-requests-remaining'],'90000')
            self.assertEqual(get.call_count,3)
    def test_provider_error_does_not_leak_key(self):
        with patch.object(odds,'credentials',return_value=['test-secret']),patch.object(odds._session,'get',return_value=SimpleNamespace(status_code=401,ok=False)):
            with self.assertRaises(RuntimeError) as error:odds._get('/sports/americanfootball_nfl/events',{})
            self.assertNotIn('test-secret',str(error.exception))
