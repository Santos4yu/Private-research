"""Kickoff weather for football (football_weather.py), on hand-made MET
Norway forecasts so every level can be worked out by hand."""
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import football_weather as weather

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=timezone.utc)
KICKOFF = '2026-10-18T17:00:00+00:00'


class FakeStore:
    def __init__(self):
        self.values = {}

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex=None):
        self.values[key] = value
        return True


def point(hour, temp=10.0, wind=3.0, gust=None, rain=0.0, chance=None, symbol='cloudy', hours=1, day=18):
    """One MET timeseries entry: wind in m/s, rain in mm over `hours`."""
    span = {'summary': {'symbol_code': symbol}, 'details': {'precipitation_amount': rain}}
    if chance is not None:
        span['details']['probability_of_precipitation'] = chance
    details = {'air_temperature': temp, 'wind_speed': wind}
    if gust is not None:
        details['wind_speed_of_gust'] = gust
    return {'time': f'2026-10-{day:02d}T{hour:02d}:00:00Z',
            'data': {'instant': {'details': details}, 'next_1_hours' if hours == 1 else 'next_6_hours': span}}


def forecast(*points):
    return weather.parse_forecast({'properties': {'timeseries': list(points)}})


class KickoffTests(unittest.TestCase):
    def test_the_game_window_and_its_numbers(self):
        # 16:00 is before the window (kickoff 17:00, from 16:30); 21:00 after it (to 20:30).
        points = forecast(point(16, wind=20), point(17, temp=5, wind=8, gust=12), point(18, wind=9, gust=15, rain=0.6, chance=70),
                          point(19, temp=3, wind=10), point(20, wind=9), point(21, wind=20))
        read = weather.at_kickoff(points, KICKOFF)
        self.assertEqual(read['tempF'], 41)
        self.assertEqual(read['lowF'], 37)
        # Average sustained wind 9 m/s, top gust 15 m/s.
        self.assertEqual(read['windMph'], round(9 * 2.237))
        self.assertEqual(read['gustMph'], round(15 * 2.237))
        self.assertEqual((read['rainMm'], read['chance'], read['snow']), (0.6, 70, False))

    def test_far_out_the_six_hour_point_the_game_falls_in(self):
        points = forecast(point(12, wind=4, rain=6.0, hours=6, symbol='rain'), point(18, wind=2, hours=6))
        read = weather.at_kickoff(points, KICKOFF)
        self.assertEqual(read['rainMm'], 1.0, 'six hours of rain read as an hourly rate')
        self.assertEqual(read['conditions'], 'Rain')
        self.assertIsNone(weather.at_kickoff(points, '2026-10-25T17:00:00Z'))

    def test_snow_from_the_symbol_or_from_cold_rain(self):
        self.assertTrue(weather.at_kickoff(forecast(point(17, symbol='lightsnow_day')), KICKOFF)['snow'])
        self.assertTrue(weather.at_kickoff(forecast(point(17, temp=0.0, rain=0.5)), KICKOFF)['snow'])
        self.assertEqual(weather.conditions('heavysnowshowers_night'), 'Heavy snow showers')


class EffectTests(unittest.TestCase):
    def read(self, **values):
        return {'windMph': 5, 'gustMph': 8, 'rainMm': 0, 'chance': 10, 'snow': False, 'thunder': False, 'tempF': 55, 'lowF': 52, **values}

    def test_calm_and_mild_does_nothing(self):
        self.assertEqual(weather.effects(self.read()), {'passing': 0, 'kicking': 0, 'run': 0, 'flags': []})

    def test_wind_levels_and_gusts(self):
        self.assertEqual(weather.effects(self.read(windMph=13))['passing'], 1)
        self.assertEqual(weather.effects(self.read(windMph=17))['passing'], 2)
        strong = weather.effects(self.read(windMph=22, gustMph=38))
        self.assertEqual((strong['passing'], strong['kicking'], strong['run']), (3, 3, 1))
        self.assertEqual(strong['flags'], [{'key': 'wind', 'level': 'high', 'label': 'Wind 22 mph, gusts to 38'}])
        gusty = weather.effects(self.read(windMph=10, gustMph=36))
        self.assertEqual(gusty['passing'], 1, 'gusts alone add a level')

    def test_rain_counts_only_when_likely(self):
        self.assertEqual(weather.effects(self.read(rainMm=3.0, chance=20))['passing'], 0)
        heavy = weather.effects(self.read(rainMm=3.0, chance=80))
        self.assertEqual((heavy['passing'], heavy['kicking'], heavy['run']), (2, 1, 1))
        self.assertEqual(heavy['flags'][0]['label'], 'Heavy rain')
        self.assertEqual(weather.effects(self.read(rainMm=0.8, chance=60))['flags'][0]['label'], 'Rain likely')

    def test_snow_wind_and_cold_stack(self):
        storm = weather.effects(self.read(snow=True, rainMm=1.2, chance=90, windMph=14, lowF=18))
        self.assertEqual((storm['passing'], storm['kicking']), (3, 3))
        self.assertEqual([flag['label'] for flag in storm['flags']], ['Wind 14 mph', 'Heavy snow', 'Freezing: 18°F'])
        cold = weather.effects(self.read(tempF=19, lowF=15))
        self.assertEqual((cold['passing'], cold['kicking'], cold['run']), (1, 1, 0))


class VenueTests(unittest.TestCase):
    def test_nfl_roofs(self):
        self.assertEqual(weather.nfl_venue({'stadium_id': 'GNB00', 'roof': 'outdoors', 'home': 'GB'})['roof'], 'outdoors')
        self.assertEqual(weather.nfl_venue({'stadium_id': 'DET00', 'roof': 'dome', 'home': 'DET'})['roof'], 'dome')
        # A retractable roof counts as shut unless the schedule says it's open.
        self.assertEqual(weather.nfl_venue({'stadium_id': 'DAL00', 'roof': '', 'home': 'DAL'})['roof'], 'retractable')
        self.assertEqual(weather.nfl_venue({'stadium_id': 'ATL97', 'roof': 'open', 'home': 'ATL'})['roof'], 'open')
        # The schedule calls Munich's stadium a dome; the field is open.
        munich = weather.nfl_venue({'stadium_id': 'MUN01', 'roof': 'dome', 'home': 'DET', 'location': 'Neutral', 'stadium': 'FC Bayern Munich Stadium'})
        self.assertEqual((munich['roof'], munich['lat'], munich['name']), ('outdoors', 48.219, 'FC Bayern Munich Stadium'))

    def test_unknown_stadiums(self):
        home = weather.nfl_venue({'stadium_id': 'NEW99', 'home_team': 'BUF', 'roof': 'outdoors', 'location': 'Home'})
        self.assertEqual((home['name'], home['lat']), ('Highmark Stadium', 42.774))
        abroad = weather.nfl_venue({'stadium_id': 'XYZ00', 'home': 'BUF', 'roof': 'outdoors', 'location': 'Neutral', 'stadium': 'Somewhere'})
        self.assertEqual((abroad['name'], abroad['lat'], abroad['roof']), ('Somewhere', None, 'outdoors'))

    def test_place_query(self):
        self.assertEqual(weather.place_query('Tuscaloosa', 'AL', 'USA'), 'Tuscaloosa, Alabama, USA')
        self.assertEqual(weather.place_query('Dublin', '', 'Ireland'), 'Dublin, Ireland')


class GameTests(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(weather, '_store', return_value=FakeStore())
        patcher.start()
        self.addCleanup(patcher.stop)
        weather._memory.clear()

    def test_covered_games_never_ask_for_a_forecast(self):
        with mock.patch.object(weather, 'hourly') as hourly:
            for roof in ('dome', 'retractable'):
                result = weather.game_weather({'name': 'X', 'roof': roof, 'lat': 1, 'lon': 1}, KICKOFF, NOW)
                self.assertEqual((result['covered'], result['passing'], result['kicking']), (True, 0, 0))
            hourly.assert_not_called()

    def test_outdoor_game(self):
        points = forecast(*[point(hour, wind=9, gust=13) for hour in range(16, 22)])
        with mock.patch.object(weather, 'hourly', return_value=points):
            result = weather.game_weather({'name': 'Lambeau Field', 'roof': 'outdoors', 'lat': 44.5, 'lon': -88.06}, KICKOFF, NOW)
        self.assertEqual((result['available'], result['windMph'], result['passing'], result['venue']), (True, 20, 2, 'Lambeau Field'))
        self.assertIn('MET Norway', result['credit'])

    def test_too_far_out_missing_place_and_outage(self):
        venue = {'name': 'X', 'roof': 'outdoors', 'lat': 1.0, 'lon': 1.0}
        later = (NOW + timedelta(days=10)).isoformat()
        self.assertFalse(weather.game_weather(venue, later, NOW)['available'])
        self.assertEqual(weather.game_weather({**venue, 'lat': None}, KICKOFF, NOW)['message'], 'Venue location unavailable.')
        with mock.patch.object(weather, 'hourly', side_effect=RuntimeError('down')):
            self.assertEqual(weather.game_weather(venue, KICKOFF, NOW)['message'], 'Weather is temporarily unavailable.')

    def test_nfl_slate(self):
        kickoff = datetime.fromisoformat(KICKOFF).timestamp()
        games = {
            '2026_07_MIA_BUF': {'season': '2026', 'home': 'BUF', 'away': 'MIA', 'stadium_id': 'BUF00', 'roof': 'outdoors', 'kickoff': kickoff, 'final': False},
            '2026_07_SEA_DET': {'season': '2026', 'home': 'DET', 'away': 'SEA', 'stadium_id': 'DET00', 'roof': 'dome', 'kickoff': kickoff, 'final': False},
            '2026_06_GB_CHI': {'season': '2026', 'home': 'CHI', 'away': 'GB', 'stadium_id': 'CHI98', 'kickoff': kickoff - 7 * 86400, 'final': True},
            '2026_10_NE_NYJ': {'season': '2026', 'home': 'NYJ', 'away': 'NE', 'stadium_id': 'NYC01', 'kickoff': kickoff + 20 * 86400, 'final': False},
        }
        points = forecast(*[point(hour, wind=11) for hour in range(16, 22)])
        with mock.patch.object(weather, 'hourly', return_value=points) as hourly:
            slate = weather.nfl_slate(2026, games=games, now=NOW)
        self.assertEqual(sorted(slate['games']), ['2026_07_MIA_BUF', '2026_07_SEA_DET'])
        self.assertEqual(slate['teams'], {'BUF': '2026_07_MIA_BUF', 'MIA': '2026_07_MIA_BUF', 'DET': '2026_07_SEA_DET', 'SEA': '2026_07_SEA_DET'})
        self.assertEqual(slate['games']['2026_07_MIA_BUF']['passing'], 3, '25 mph of wind')
        self.assertTrue(slate['games']['2026_07_SEA_DET']['covered'])
        hourly.assert_called_once_with(42.774, -78.787)


class CollegeTests(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(weather, '_store', return_value=FakeStore())
        patcher.start()
        self.addCleanup(patcher.stop)
        weather._memory.clear()

    def game(self, event, city, indoor=False):
        return {'id': event, 'start': KICKOFF, 'completed': False, 'home': {'abbr': f'H{event}'}, 'away': {'abbr': f'A{event}'},
                'venue': {'name': f'{city} Stadium', 'city': city, 'state': 'AL', 'country': 'USA', 'indoor': indoor}}

    def test_towns_are_looked_up_a_few_a_call_focus_first(self):
        games = [self.game(str(index), f'Town{index}') for index in range(1, 7)] + [self.game('9', 'Atlanta', indoor=True)]
        looked = []

        def town(city, state='', country='', allow_lookup=True):
            if allow_lookup:
                looked.append(city)
                return {'lat': 33.0, 'lon': -87.0}
            return None
        points = forecast(*[point(hour) for hour in range(16, 22)])
        with mock.patch.object(weather, 'town', side_effect=town), mock.patch.object(weather, 'hourly', return_value=points), \
                mock.patch.object(weather.time, 'sleep') as sleep:
            slate = weather.cfb_slate(games, now=NOW, lookups=2, focus='5')
        self.assertEqual(looked, ['Town5', 'Town1'])
        self.assertEqual(sleep.call_count, 1)
        self.assertEqual(slate['pending'], 4)
        self.assertTrue(slate['games']['5']['available'])
        self.assertTrue(slate['games']['3']['pending'])
        self.assertTrue(slate['games']['9']['covered'], 'indoor games need no town')
        self.assertEqual(slate['teams']['H5'], '5')

    def test_a_venue_without_a_town_is_not_pending(self):
        venue = weather.cfb_venue({'name': 'Field', 'city': '', 'indoor': False}, allow_lookup=False)
        self.assertFalse(venue.get('pending'))


if __name__ == '__main__':
    unittest.main()
