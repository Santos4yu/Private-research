"""Clearly synthetic test-only vectors; never used by production services."""
import unittest
from backend.sports.nfl.distributions import (joint_bootstrap, summarize, compare_line,
                                             validate_vector, fingerprint, unavailable)


class DistributionTests(unittest.TestCase):
    def records(self):
        return [{'season': 2024, 'week': w, 'values': {'plays': 60, 'dropbacks': 35,
                 'attempts': 32, 'rushes': 25, 'targets': w, 'receptions': w // 2,
                 'carries': 10, 'receiving_yards': w * 7, 'rushing_yards': 30}}
                for w in range(1, 11)]

    def test_joint_and_reproducible(self):
        a = joint_bootstrap(self.records(), 2024, 11, seed=9)
        self.assertEqual(a, joint_bootstrap(self.records(), 2024, 11, seed=9))
        for row in a:
            validate_vector(row)
            self.assertEqual(row['receiving_yards'], row['targets'] * 7)

    def test_future_excluded(self):
        rows = self.records() + [{'season': 2025, 'week': 1, 'values': None}]
        self.assertEqual(joint_bootstrap(rows, 2024, 11), joint_bootstrap(self.records(), 2024, 11))

    def test_missing_not_zero(self):
        rows = self.records(); rows[0]['values']['targets'] = None
        with self.assertRaises(ValueError): joint_bootstrap(rows, 2024, 11)

    def test_count_constraints(self):
        for values in ({'targets': -1}, {'targets': 1.5}, {'targets': 2, 'receptions': 3},
                       {'plays': 50, 'dropbacks': 30, 'rushes': 30}):
            with self.assertRaises(ValueError): validate_vector(values)

    def test_push_and_half_line(self):
        for line in (2, 2.5):
            r = compare_line([1, 2, 3, 4], line)
            self.assertAlmostEqual(sum(r[k] for k in ('rawOverProbability', 'rawUnderProbability', 'rawPushProbability')), 1)
            self.assertEqual(r['rawPushProbability'], .25 if line == 2 else 0)
            self.assertIsNone(r['calibratedOverProbability'])

    def test_skew_and_percentiles(self):
        r = summarize([0] * 8 + [1, 100])
        self.assertNotEqual(r['mean'], r['median'])
        p = list(r['percentiles'].values()); self.assertEqual(p, sorted(p))

    def test_cache_inputs(self):
        a = fingerprint({'role': 'STABLE'}, 'V1', 9, 10000)
        self.assertNotEqual(a, fingerprint({'role': 'UNCERTAIN'}, 'V1', 9, 10000))
        self.assertNotEqual(a, fingerprint({'role': 'STABLE'}, 'V2', 9, 10000))

    def test_unavailable(self):
        r = unavailable({'projectionMean': 0, 'modelVersion': 'V1'})
        self.assertEqual(r['projectionMean'], 0)
        self.assertIsNone(r['projectionMedian'])
        self.assertIsNone(r['rawOverProbability'])
        self.assertEqual(r['status'], 'NOT_AVAILABLE')
