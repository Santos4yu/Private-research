import unittest
from unittest.mock import patch
from types import SimpleNamespace

import tennis_weather as weather


def reply(data):
    return SimpleNamespace(json=lambda: data, raise_for_status=lambda: None)


def forecast(*points):
    series = []
    for time, temp, wind, rain, symbol in points:
        series.append({'time': time, 'data': {'instant': {'details': {'air_temperature': temp, 'wind_speed': wind, 'relative_humidity': 60}},
                                              'next_1_hours': {'summary': {'symbol_code': symbol}, 'details': {'precipitation_amount': rain}}}})
    return {'properties': {'timeseries': series}}


class WeatherTests(unittest.TestCase):
    def setUp(self):
        weather._memory.clear()
        self.saved = {}
        self.enterContext(patch.object(weather, 'read', side_effect=lambda key: self.saved.get(key)))
        self.enterContext(patch.object(weather, 'write', side_effect=lambda key, value: self.saved.__setitem__(key, value)))
        self.enterContext(patch.object(weather.time, 'sleep'))

    def test_indoor_events_need_no_lookups(self):
        with patch.object(weather.requests, 'get', side_effect=AssertionError('network')):
            self.assertEqual(weather.match_weather('Paris Masters', 'I.hard', 'FRA', '2026-10-30T13:00:00Z'), {'indoor': True})

    def test_rain_at_match_time_flags_a_delay_risk(self):
        geo = [{'display_name': 'Shanghai, Huangpu, China', 'lat': '31.2304', 'lon': '121.4737'}]
        met = forecast(('2026-10-05T05:00:00Z', 24.0, 3.0, 0.0, 'cloudy'),
                       ('2026-10-05T06:00:00Z', 23.0, 4.0, 1.2, 'rain'),
                       ('2026-10-05T07:00:00Z', 22.0, 9.5, 0.4, 'lightrain'),
                       ('2026-10-05T12:00:00Z', 20.0, 2.0, 0.0, 'clearsky_night'))
        def get(url, params=None, **kwargs):
            if url == weather.GEOCODER:
                self.assertEqual(params['countrycodes'], 'cn')
                return reply(geo if params['q'] == 'Shanghai' else [])
            return reply(met)
        with patch.object(weather.requests, 'get', side_effect=get) as calls:
            result = weather.match_weather('Rolex Shanghai Masters', 'Hard', 'CHN', '2026-10-05T06:00:00Z')
            again = weather.match_weather('Rolex Shanghai Masters', 'Hard', 'CHN', '2026-10-05T06:00:00Z')
        self.assertEqual(result, again)
        self.assertEqual(calls.call_count, 3)  # two city searches and one forecast, then saved
        self.assertEqual(result['venue'], 'Shanghai, China')
        self.assertEqual((result['tempF'], result['windMph'], result['rainMm']), (73, 21, 1.2))
        self.assertEqual([f['key'] for f in result['flags']], ['rain', 'wind'])
        self.assertEqual(result['conditions'], 'Rain')
        self.assertIn('MET Norway', result['credit'])

    def test_dry_mild_match_has_no_flags_and_far_future_waits_for_forecast(self):
        points = [{'time': '2026-10-05T18:00:00Z', 'temp': 21.0, 'wind': 2.0, 'humidity': 50, 'hours': 1, 'rain': 0.0, 'symbol': 'fair_day'}]
        calm = weather.summary(points, '2026-10-05T18:00:00Z')
        self.assertEqual((calm['flags'], calm['conditions']), ([], 'Mostly clear'))
        self.assertFalse(weather.summary(points, '2026-10-20T18:00:00Z')['available'])

    def test_unknown_city_is_not_searched_again_on_every_view(self):
        with patch.object(weather.requests, 'get', return_value=reply([])) as calls:
            first = weather.match_weather('Mystery Cup', 'Clay', None, '2026-10-05T10:00:00Z')
            weather._memory.clear()
            weather.match_weather('Mystery Cup', 'Clay', None, '2026-10-05T10:00:00Z')
        self.assertFalse(first['available'])
        self.assertEqual(calls.call_count, 1)

    def test_outage_never_breaks_the_matchup(self):
        with patch.object(weather.requests, 'get', side_effect=ConnectionError()):
            self.assertFalse(weather.match_weather('Tokyo', 'Hard', 'JPN', '2026-10-05T10:00:00Z')['available'])


if __name__ == '__main__':
    unittest.main()
