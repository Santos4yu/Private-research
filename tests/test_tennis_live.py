import unittest
from unittest.mock import patch
import tennis_live


class TennisLiveTests(unittest.TestCase):
    def match(self):
        return {'matchId':'42','date':'2026-09-29T20:00:00Z','result':'4-6 6-2 7-6(8)',
                'result_type':'completed','player1Id':1,'player2Id':2,
                'player1':{'id':1,'name':'Player One'},'player2':{'id':2,'name':'Player Two'},
                'tournament':{'id':3,'name':'Test'},'roundId':4}

    def test_exact_serving_stats_and_fantasy(self):
        stats={'player1Stats':{'player1Id':1,'aces':12,'doubleFaults':1,
                              'breakPointWonGm':4,'breakPointChanceGm':16},
               'player2Stats':{'player2Id':2,'aces':0,'doubleFaults':2}}
        a,b=tennis_live.parse_result(self.match(),'atp',stats)
        self.assertEqual(a['values']['breakpointswon'],4)
        self.assertEqual(a['values']['breakpointswonpercentage'],25)
        self.assertEqual(a['values']['acesallowed'],0)
        self.assertEqual(a['values']['fantasyscore'],21.5)
        self.assertEqual(b['values']['aces'],0)

    def test_missing_stats_are_not_zero(self):
        a,b=tennis_live.parse_result(self.match(),'atp',{})
        self.assertNotIn('aces',a['values'])
        self.assertNotIn('fantasyscore',a['values'])
        match=self.match();match['result_type']='retired'
        self.assertEqual(tennis_live.parse_result(match,'atp',{}),[])

    def test_identity_mismatch_cannot_attach_stats(self):
        rows=tennis_live.parse_result(self.match(),'atp',{'player1Stats':{'player1Id':99,'aces':30}})
        self.assertNotIn('aces',rows[0]['values'])
        self.assertNotIn('acesallowed',rows[1]['values'])

    def test_daily_cap_prevents_http_call(self):
        with patch.object(tennis_live,'setting',return_value='private'), patch.object(tennis_live,'redis',side_effect=[41,1]), patch.object(tennis_live,'urlopen') as http:
            with self.assertRaises(RuntimeError):
                tennis_live.api('/test')
            http.assert_not_called()


if __name__=='__main__':
    unittest.main()
