"""Match-day weather for outdoor tennis.

Forecasts come from MET Norway's free Locationforecast service (credited on
the page). Each tournament's city is looked up once through OpenStreetMap's
Nominatim and saved. Indoor events never need either.
"""
import re
import time
from datetime import datetime, timedelta, timezone

import requests

from tennis_live import read, write

AGENT = 'AceProps/1.0 (https://aceprops.xyz)'
GEOCODER = 'https://nominatim.openstreetmap.org/search'
FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'
VENUE_SECONDS = 30 * 86400
MISSING_VENUE_SECONDS = 7 * 86400
FORECAST_SECONDS = 3600
# Hours around the scheduled start that the match is likely to be played in.
WINDOW_BEFORE, WINDOW_AFTER = 1, 3
RAIN_MM, HEAVY_RAIN_MM = 0.3, 2.0
WINDY_MS, HOT_C, COLD_C = 8.0, 32.0, 10.0
WET = ('rain', 'sleet', 'snow', 'thunder', 'showers')
# Country codes as tennis data lists them (IOC) for the hosts of most events.
COUNTRIES = {
    'USA': 'us', 'CAN': 'ca', 'MEX': 'mx', 'ARG': 'ar', 'BRA': 'br', 'CHI': 'cl', 'COL': 'co', 'ECU': 'ec', 'PER': 'pe',
    'URU': 'uy', 'GBR': 'gb', 'FRA': 'fr', 'ESP': 'es', 'ITA': 'it', 'GER': 'de', 'SUI': 'ch', 'AUT': 'at', 'NED': 'nl',
    'BEL': 'be', 'SWE': 'se', 'NOR': 'no', 'FIN': 'fi', 'DEN': 'dk', 'POL': 'pl', 'CZE': 'cz', 'SVK': 'sk', 'HUN': 'hu',
    'ROU': 'ro', 'BUL': 'bg', 'CRO': 'hr', 'SRB': 'rs', 'SLO': 'si', 'BIH': 'ba', 'GRE': 'gr', 'POR': 'pt', 'TUR': 'tr',
    'ISR': 'il', 'MAR': 'ma', 'TUN': 'tn', 'EGY': 'eg', 'RSA': 'za', 'QAT': 'qa', 'UAE': 'ae', 'KSA': 'sa', 'IND': 'in',
    'CHN': 'cn', 'HKG': 'hk', 'TPE': 'tw', 'JPN': 'jp', 'KOR': 'kr', 'THA': 'th', 'KAZ': 'kz', 'UZB': 'uz', 'AUS': 'au',
    'NZL': 'nz', 'MON': 'mc', 'EST': 'ee', 'LAT': 'lv', 'LTU': 'lt', 'UKR': 'ua', 'GEO': 'ge', 'SGP': 'sg', 'IRL': 'ie',
}
# Words in event names that are never the host city.
NOT_PLACE = re.compile(r"\b(atp|wta|itf|challenger|open|masters|championships?|internationa(?:l|ux)s?|classic|cup|trophy|"
                       r"tennis|tournament|grand|prix|presented|by|series|finals?|ladies|men'?s|women'?s|"
                       r"\d+k?)\b", re.I)
CONDITIONS = {'clearsky': 'Clear', 'fair': 'Mostly clear', 'partlycloudy': 'Partly cloudy', 'cloudy': 'Cloudy',
              'fog': 'Fog', 'lightrain': 'Light rain', 'rain': 'Rain', 'heavyrain': 'Heavy rain',
              'lightrainshowers': 'Light showers', 'rainshowers': 'Showers', 'heavyrainshowers': 'Heavy showers'}
_memory = {}


def indoor(court):
    court = court.get('name') if isinstance(court, dict) else court
    return bool(re.search(r'(^|[^a-z])i\.|indoor', str(court or ''), re.I))


def _cached(key, seconds, load, missing_seconds=None):
    """This server's copy, then the saved one, then a fresh lookup. A
    lookup that found nothing is kept for `missing_seconds` instead."""
    def fresh(at, data):
        return time.time() - at < (missing_seconds if data is None and missing_seconds else seconds)
    hit = _memory.get(key)
    if hit and fresh(*hit):
        return hit[1]
    saved = read(key)
    if saved and fresh(saved['at'], saved['data']):
        _memory[key] = (saved['at'], saved['data'])
        return saved['data']
    data = load()
    write(key, {'at': time.time(), 'data': data})
    _memory[key] = (time.time(), data)
    return data


def place_names(event):
    """Search terms for the host city: the cleaned name, then its words."""
    name = re.sub(r'\(.*?\)', ' ', str(event or ''))
    if ' - ' in name:
        name = name.rsplit(' - ', 1)[-1]
    name = ' '.join(NOT_PLACE.sub(' ', name).split())
    words = sorted({w for w in name.split() if len(w) >= 4}, key=len, reverse=True)
    return list(dict.fromkeys([name, *words]))[:3] if name else []


def venue(event, country=None):
    """{'name', 'lat', 'lon'} for an event's host city, or None."""
    code = COUNTRIES.get(str(country or '').upper())
    key = 'weather:venue:' + re.sub('[^a-z0-9]', '', str(event or '').lower()) + ':' + (code or '')

    def look_up():
        for index, term in enumerate(place_names(event)):
            if index:
                time.sleep(1)  # The free geocoder allows one request a second.
            params = {'q': term, 'format': 'jsonv2', 'limit': 1, 'featureType': 'settlement'}
            if code:
                params['countrycodes'] = code
            found = requests.get(GEOCODER, params=params, headers={'User-Agent': AGENT}, timeout=5).json()
            if found:
                parts = [p.strip() for p in found[0]['display_name'].split(',')]
                return {'name': ', '.join(dict.fromkeys([parts[0], parts[-1]])),
                        'lat': round(float(found[0]['lat']), 2), 'lon': round(float(found[0]['lon']), 2)}
        return None

    if not event:
        return None
    # An unknown city is retried weekly rather than on every page view.
    return _cached(key, VENUE_SECONDS, look_up, MISSING_VENUE_SECONDS)


def hourly(lat, lon):
    """Hourly (later six-hourly) forecast points for a place."""
    def load():
        response = requests.get(FORECAST, params={'lat': lat, 'lon': lon}, headers={'User-Agent': AGENT}, timeout=6)
        response.raise_for_status()
        points = []
        for item in response.json()['properties']['timeseries']:
            data = item.get('data') or {}
            now = (data.get('instant') or {}).get('details') or {}
            span, hours = (data.get('next_1_hours'), 1) if data.get('next_1_hours') else (data.get('next_6_hours'), 6)
            span = span or {}
            points.append({'time': item['time'], 'temp': now.get('air_temperature'), 'wind': now.get('wind_speed'),
                           'humidity': now.get('relative_humidity'), 'hours': hours,
                           'rain': (span.get('details') or {}).get('precipitation_amount'),
                           'symbol': (span.get('summary') or {}).get('symbol_code')})
        return points
    return _cached(f'weather:forecast:{lat:.2f},{lon:.2f}', FORECAST_SECONDS, load)


def _when(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None


def conditions(symbol):
    base = re.sub(r'_(day|night|polartwilight)$', '', str(symbol or ''))
    if base in CONDITIONS:
        return CONDITIONS[base]
    text = ' '.join(re.findall(r'heavy|light|rain|sleet|snow|showers|and|thunder|partly|cloudy|fog', base))
    return text[:1].upper() + text[1:] if text else None


def summary(points, starts_at):
    start = _when(starts_at) or datetime.now(timezone.utc)
    window = [p for p in points if _when(p['time']) and
              start - timedelta(hours=WINDOW_BEFORE) <= _when(p['time']) <= start + timedelta(hours=WINDOW_AFTER)]
    if not window:
        # A six-hourly point can begin up to six hours before the start.
        earlier = [p for p in points if _when(p['time']) and start - timedelta(hours=6) < _when(p['time']) <= start]
        window = earlier[-1:]
    if not window:
        return {'available': False, 'message': 'The forecast for this match is not out yet.'}
    first = min(window, key=lambda p: abs((_when(p['time']) - start).total_seconds()))
    per_hour = [p['rain'] / p['hours'] for p in window if isinstance(p.get('rain'), (int, float))]
    rain = max(per_hour, default=0.0)
    wind = max((p['wind'] for p in window if isinstance(p.get('wind'), (int, float))), default=None)
    temp = first.get('temp')
    wet = rain >= RAIN_MM or any(w in str(p.get('symbol') or '') for p in window for w in WET)
    flags = []
    if wet:
        heavy = rain >= HEAVY_RAIN_MM or any('thunder' in str(p.get('symbol') or '') for p in window)
        flags.append({'key': 'rain', 'label': 'High rain delay risk' if heavy else 'Rain delay risk', 'level': 'high' if heavy else 'medium'})
    if isinstance(wind, (int, float)) and wind >= WINDY_MS:
        flags.append({'key': 'wind', 'label': 'Windy (affects serve and toss)', 'level': 'medium'})
    if isinstance(temp, (int, float)) and temp >= HOT_C:
        flags.append({'key': 'heat', 'label': 'Hot (heat breaks, fatigue)', 'level': 'medium'})
    elif isinstance(temp, (int, float)) and temp < COLD_C:
        flags.append({'key': 'cold', 'label': 'Cold (heavier, slower balls)', 'level': 'low'})
    return {'available': True, 'at': first['time'],
            'tempC': temp, 'tempF': round(temp * 9 / 5 + 32) if isinstance(temp, (int, float)) else None,
            'windMph': round(wind * 2.237) if isinstance(wind, (int, float)) else None,
            'humidity': first.get('humidity'), 'rainMm': round(rain, 1),
            'conditions': conditions(first.get('symbol')), 'flags': flags}


def match_weather(event, court, country, starts_at):
    """What the page shows for one match. Never raises."""
    if indoor(court):
        return {'indoor': True}
    try:
        place = venue(event, country)
        if not place:
            return {'available': False, 'message': 'Venue location unavailable.'}
        result = summary(hourly(place['lat'], place['lon']), starts_at)
        return {**result, 'venue': place['name'], 'source': 'MET Norway', 'credit': 'Forecast: MET Norway · Map data: OpenStreetMap'}
    except Exception:
        return {'available': False, 'message': 'Weather is temporarily unavailable.'}
