import unittest
from datetime import datetime,timezone
from mlb_matchup import identify_event,parse_predictor

class PredictorTests(unittest.TestCase):
    def setUp(self):
        self.event={'id':'123','date':'2026-09-26T18:00:00Z','competitions':[{'competitors':[
            {'homeAway':'home','team':{'id':'1','abbreviation':'TOR','displayName':'Toronto Blue Jays','color':'134a8e'}},
            {'homeAway':'away','team':{'id':'2','abbreviation':'CIN','displayName':'Cincinnati Reds','color':'cc0022'}}]}]}
        self.summary={'predictor':{'homeTeam':{'id':'1','gameProjection':'69.2'},'awayTeam':{'id':'2','gameProjection':'30.8'}}}
    def test_percentages_preserve_team_orientation(self):
        result=parse_predictor(self.summary,self.event)
        self.assertEqual(result['home']['percent'],69.2)
        self.assertEqual(result['away']['abbr'],'CIN')
    def test_missing_mismatched_and_invalid_data_are_not_guessed(self):
        self.assertIsNone(parse_predictor({},self.event))
        self.summary['predictor']['homeTeam']['id']='wrong'
        self.assertIsNone(parse_predictor(self.summary,self.event))
        self.summary['predictor']['homeTeam']={'id':'1','gameProjection':'NaN'}
        self.assertIsNone(parse_predictor(self.summary,self.event))
    def test_match_requires_both_teams_start_and_unambiguous_game(self):
        start=datetime(2026,9,26,18,tzinfo=timezone.utc)
        self.assertEqual(identify_event([self.event],'CIN','Toronto Blue Jays',start),self.event)
        self.assertIsNone(identify_event([self.event],'CIN','NYM',start))
        self.assertIsNone(identify_event([self.event,self.event],'CIN','TOR',start))

if __name__=='__main__':unittest.main()
