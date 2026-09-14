"""All identities/lines in this file are mock test fixtures."""
import unittest
from types import SimpleNamespace as Obj
from datetime import datetime,timezone
from copy import deepcopy
from dataclasses import dataclass
from unittest.mock import patch
from backend.sports.nfl.research_board import screen,support,attach_opponent_volume
class ResearchBoardTests(unittest.TestCase):
 def setUp(self):
  self.now=datetime(2026,9,13,tzinfo=timezone.utc)
  self.event=dict(gameId='2026_02_A_B',week=2,startsAt='2026-09-14T00:00:00Z')
  self.row=dict(playerId='mock',teamId='A',propType='passing_yards',gameId=self.event['gameId'],line=dict(playerId='mock',gameId=self.event['gameId'],propType='passing_yards',bookmaker='prizepicks',category='STANDARD',verified=True,value=200.5,direction='OVER',updatedAt=self.now.isoformat()))
  self.logs=[Obj(player_id='mock',team_id='A',season_type='REG',game_id=f'2025_{w}_A_C',season=2025,week=w,stats={'passing_yards':250}) for w in range(1,11)]
 def run_screen(self):return screen([self.row],{'mock':self.logs},self.event,self.now)
 def test_supported_history(self):
  r=self.run_screen()[0];self.assertEqual(r['hits'],10);self.assertEqual(r['average'],250);self.assertNotIn('probability',r)
 def test_future_and_duplicates_cannot_expand_sample(self):
  self.logs += [deepcopy(self.logs[0]) for _ in range(20)]
  future=deepcopy(self.logs[0]);future.season=2027;future.game_id='2027_01_A_C';self.logs.append(future)
  self.assertEqual(self.run_screen()[0]['sample'],10)
 def test_missing_not_zero_and_small_sample(self):
  for log in self.logs[:3]:log.stats['passing_yards']=None
  self.assertEqual(self.run_screen(),[])
 def test_alt_stale_unverified_missing_line_rejected(self):
  for key,value in [('category','GOBLIN'),('updatedAt','2026-09-12T00:00:00Z'),('verified',False),('value',None),('playerId','other')]:
   original=self.row['line'][key];self.row['line'][key]=value;self.assertEqual(self.run_screen(),[]);self.row['line'][key]=original
 def test_other_team_and_postseason_excluded(self):
  self.logs[0].team_id='B';self.logs[1].season_type='POST';self.assertEqual(self.run_screen()[0]['sample'],8)
 def test_only_one_real_direction(self):
  other=deepcopy(self.row);other['line']['direction']='UNDER'
  result=screen([other,self.row],{'mock':self.logs},self.event,self.now)
  self.assertEqual(len(result),1);self.assertEqual(result[0]['line']['direction'],'OVER')
 def test_sample_adjustment(self):self.assertGreater(support(20,20),support(8,8))
 def test_started_event_is_empty(self):
  self.event['startsAt']=self.now.isoformat();self.assertEqual(self.run_screen(),[])

@dataclass
class MockPlayer:
 id:str;position:str

class AttachOpponentVolumeTests(unittest.TestCase):
 """Descriptive enrichment only: must never drop/reorder rows or raise on missing data."""
 def fixture(self):
  data={'games':[],'players':[]}
  for team in range(9):
   for week in range(1,5):
    identity={'game_id':f'mock-{team}-{week}','team_id':'OFF','week':week}
    data['games'].append({**identity,'opponent_team_id':f'D{team}','metrics':{'ypc':{'n':20+team,'sum':100},'scramble_rate':{'n':35,'sum':2},'completion_rate':{'n':30+team,'sum':20}}})
    data['players'].append({**identity,'player_id':'p1','metrics':{'sack_rate':{'n':35,'sum':2},'ypc':{'n':team+2,'sum':team*3}}})
  return data
 def roster(self):return {'p1':MockPlayer('p1','QB'),'p2':MockPlayer('p2','WR')}
 @patch('backend.sports.nfl.research_board.season_data')
 def test_attaches_context_for_supported_prop(self,mock_season_data):
  mock_season_data.return_value=self.fixture()
  rows=[{'playerId':'p1','propType':'passing_attempts','opponentId':'D4'}]
  result=attach_opponent_volume(rows,2026,5,self.roster())
  self.assertEqual(result[0]['opponentVolume']['score'],50)
 @patch('backend.sports.nfl.research_board.season_data')
 def test_unsupported_prop_leaves_row_unchanged(self,mock_season_data):
  mock_season_data.return_value=self.fixture()
  rows=[{'playerId':'p2','propType':'receiving_yards','opponentId':'D4'}]
  self.assertEqual(attach_opponent_volume(rows,2026,5,self.roster()),rows)
 @patch('backend.sports.nfl.research_board.season_data')
 def test_dataset_failure_returns_rows_unchanged(self,mock_season_data):
  mock_season_data.side_effect=RuntimeError('boom')
  rows=[{'playerId':'p1','propType':'passing_attempts','opponentId':'D4'}]
  self.assertEqual(attach_opponent_volume(rows,2026,5,self.roster()),rows)
 def test_missing_player_or_opponent_leaves_row_unchanged(self):
  rows=[{'playerId':'unknown','propType':'passing_attempts','opponentId':'D4'}]
  self.assertEqual(attach_opponent_volume(rows,2026,5,self.roster()),rows)
 def test_empty_rows_short_circuit(self):
  self.assertEqual(attach_opponent_volume([],2026,5,self.roster()),[])
