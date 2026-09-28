import unittest
from pitcher_comparisons import aggregate, normalize

class ComparisonTests(unittest.TestCase):
    def test_rates_use_total_outs(self):
        rows=[{'outs':18,'earnedRuns':2,'hits':4,'baseOnBalls':1,'strikeOuts':6,'homeRuns':1,'atBats':22,'wins':1,'losses':0},
              {'outs':1,'earnedRuns':1,'hits':2,'baseOnBalls':1,'strikeOuts':0,'homeRuns':0,'atBats':3,'wins':0,'losses':1}]
        result=aggregate(rows)
        self.assertEqual(result['inningsPitched'],'6.1')
        self.assertEqual(result['era'],round(81/19,3))
        self.assertEqual(result['avgAgainst'],.24)
    def test_missing_not_zero(self):
        self.assertEqual(aggregate([]),{})
        self.assertIsNone(aggregate([{'outs':0}])['era'])
        self.assertIsNone(normalize({})['avgAgainst'])
