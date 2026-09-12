"""Synthetic chronology fixtures confined to tests."""
import unittest
from backend.sports.nfl.history_inputs import axis,compact_history

class NFLHistoryInputsTests(unittest.TestCase):
    def test_prior_and_current_week_axis_preserves_original_metadata(self):
        previous=axis([{'season':2025,'week':18,'season_type':'REG'}],2025,2026,2,raw=True)[0]
        self.assertEqual(previous['week'],'0');self.assertEqual(previous['sourceWeek'],18);self.assertEqual(previous['sourceSeason'],2025)
        current=axis([{'season':2026,'week':1}],2026,2026,2)[0]
        self.assertEqual(current['week'],1)
    def test_future_postseason_and_invalid_weeks_excluded(self):
        rows=[{'week':1},{'week':2},{'week':3},{'week':0},{'week':19},{'week':1,'season_type':'POST'}]
        self.assertEqual([row['week'] for row in axis(rows,2026,2026,2)],[1])
    def test_mixed_source_season_rejected(self):
        with self.assertRaises(ValueError):axis([{'week':1,'season':2024}],2025,2026,2)
    def test_current_missing_can_use_labelled_prior_not_zero(self):
        def provider(year):
            if year==2026:raise RuntimeError('test missing season')
            return {'games':[{'week':18,'team_id':'TEST','metrics':{'ypa':None}}],'sourceUrl':'test-only'}
        data=compact_history(provider,2026,2,('games',))
        self.assertTrue(data['history']['usesPriorSeason']);self.assertIsNone(data['games'][0]['metrics']['ypa'])
    def test_later_season_never_requests_prior_fallback(self):
        calls=[]
        def provider(year):calls.append(year);return {'games':[]}
        compact_history(provider,2026,5,('games',))
        self.assertEqual(calls,[2026])
    def test_provider_rows_not_mutated(self):
        row={'week':18,'stats':{'targets':0}}
        output=axis([row],2025,2026,2)
        output[0]['stats']['targets']=4
        self.assertEqual(row,{'week':18,'stats':{'targets':0}})
