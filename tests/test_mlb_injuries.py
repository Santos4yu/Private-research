import unittest
from unittest.mock import patch, Mock
from mlb_injuries import normalize_report, get_injury_report, _report


class InjuryReportTests(unittest.TestCase):
    def test_structured_details_and_dates_are_preserved(self):
        result = normalize_report({'injuries':[{'id':'1','displayName':'Team','injuries':[{
            'id':'2','status':'10-Day-IL','date':'2026-09-26T18:00Z',
            'shortComment':'Some publication reports something.',
            'details':{'type':'Ankle','side':'Left','detail':'Sprain','returnDate':'2026-10-10'},
            'athlete':{'displayName':'Test Player','position':{'abbreviation':'SS'},'team':{'abbreviation':'TST'}}}]}]})
        player=result['teams'][0]['players'][0]
        self.assertEqual(player['reason'],'Left Ankle Sprain')
        self.assertEqual(player['expectedReturn'],'2026-10-10')
        self.assertNotIn('publication',str(result))
        self.assertEqual(result['teams'][0]['abbr'],'TST')

    def test_missing_return_is_not_invented_from_il_status(self):
        result=normalize_report({'injuries':[{'injuries':[{'status':'60-Day-IL','athlete':{'displayName':'Player'}}]}]})
        self.assertIsNone(result['teams'][0]['players'][0]['expectedReturn'])
        self.assertEqual(result['teams'][0]['players'][0]['reason'],'Injury details not reported')

    def test_invalid_payload_is_not_a_healthy_roster(self):
        with self.assertRaises(ValueError): normalize_report({})

    def test_cache_and_failed_request_retry(self):
        _report.cache_clear()
        response=Mock()
        response.json.return_value={'injuries':[]}
        with patch('mlb_injuries.requests.get',side_effect=[RuntimeError('offline'),response]) as fetch:
            with self.assertRaises(RuntimeError): get_injury_report()
            self.assertEqual(get_injury_report()['teams'],[])
            get_injury_report()
            self.assertEqual(fetch.call_count,2)
        _report.cache_clear()
