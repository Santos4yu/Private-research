"""Kickoff weather for NFL and college football games.

Forecasts come from MET Norway's free Locationforecast service (credited on
the page), as for tennis (tennis_weather.py). NFL stadiums are listed below
with their roofs; a college game's town is looked up once through
OpenStreetMap's Nominatim and kept. A game under a fixed roof needs
neither, and a retractable roof is taken as shut unless the schedule says
it's open: teams close it when the weather turns.

What the weather does to props (read by src/slip-matchup.js and the player
pages): wind is what hurts passing and kicking most; heavy rain and snow
hurt passing and push teams to run; bitter cold trims passing and kicking
a little. Each game gets a level from 0 (no effect) to 3 for passing and
kicking, and a lean toward the run when passing takes a real hit.
"""
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

AGENT = 'AceProps/1.0 (https://aceprops.xyz)'
FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/complete'
GEOCODER = 'https://nominatim.openstreetmap.org/search'
CREDIT = 'Forecast: MET Norway'
# College towns are found on OpenStreetMap's map data.
PLACE_CREDIT = 'Forecast: MET Norway · Map data: OpenStreetMap'
VERSION = 'football-weather-v1'
FORECAST_SECONDS = 3600
PLACE_SECONDS = 60 * 86400
MISSING_PLACE_SECONDS = 7 * 86400
SLATE_SECONDS = 30 * 60
# Forecasts reach about ten days out; past a week they say little.
AHEAD_DAYS = 8
# A game runs about three and a half hours from kickoff.
GAME_HOURS = 3.5
# The free geocoder allows one lookup a second: a slate looks up this many
# new towns a call and leaves the rest for the next one.
LOOKUPS_PER_CALL = 4

# NFL stadiums: (name, latitude, longitude, roof). "dome" is a fixed roof
# (SoFi's is fixed with open sides), "retractable" one that can open.
STADIUMS = {
    'ATL97': ('Mercedes-Benz Stadium', 33.755, -84.401, 'retractable'),
    'BAL00': ('M&T Bank Stadium', 39.278, -76.623, 'outdoors'),
    'BOS00': ('Gillette Stadium', 42.091, -71.264, 'outdoors'),
    'BUF00': ('Highmark Stadium', 42.774, -78.787, 'outdoors'),
    'CAR00': ('Bank of America Stadium', 35.226, -80.853, 'outdoors'),
    'CHI98': ('Soldier Field', 41.862, -87.617, 'outdoors'),
    'CIN00': ('Paycor Stadium', 39.095, -84.516, 'outdoors'),
    'CLE00': ('Huntington Bank Field', 41.506, -81.700, 'outdoors'),
    'DAL00': ('AT&T Stadium', 32.748, -97.093, 'retractable'),
    'DEN00': ('Empower Field at Mile High', 39.744, -105.020, 'outdoors'),
    'DET00': ('Ford Field', 42.340, -83.046, 'dome'),
    'GNB00': ('Lambeau Field', 44.501, -88.062, 'outdoors'),
    'HOU00': ('NRG Stadium', 29.685, -95.411, 'retractable'),
    'IND00': ('Lucas Oil Stadium', 39.760, -86.164, 'retractable'),
    'JAX00': ('EverBank Stadium', 30.324, -81.637, 'outdoors'),
    'KAN00': ('GEHA Field at Arrowhead Stadium', 39.049, -94.484, 'outdoors'),
    'LAX01': ('SoFi Stadium', 33.953, -118.339, 'dome'),
    'MIA00': ('Hard Rock Stadium', 25.958, -80.239, 'outdoors'),
    'MIN01': ('U.S. Bank Stadium', 44.974, -93.258, 'dome'),
    'NAS00': ('Nissan Stadium', 36.166, -86.771, 'outdoors'),
    'NOR00': ('Caesars Superdome', 29.951, -90.081, 'dome'),
    'NYC01': ('MetLife Stadium', 40.814, -74.074, 'outdoors'),
    'PHI00': ('Lincoln Financial Field', 39.901, -75.168, 'outdoors'),
    'PHO00': ('State Farm Stadium', 33.528, -112.263, 'retractable'),
    'PIT00': ('Acrisure Stadium', 40.447, -80.016, 'outdoors'),
    'SEA00': ('Lumen Field', 47.595, -122.332, 'outdoors'),
    'SFO01': ("Levi's Stadium", 37.403, -121.970, 'outdoors'),
    'TAM00': ('Raymond James Stadium', 27.976, -82.503, 'outdoors'),
    'VEG00': ('Allegiant Stadium', 36.091, -115.184, 'dome'),
    'WAS00': ('Northwest Stadium', 38.908, -76.864, 'outdoors'),
    # Games abroad.
    'LON00': ('Wembley Stadium', 51.556, -0.280, 'outdoors'),
    'LON02': ('Tottenham Hotspur Stadium', 51.604, -0.066, 'outdoors'),
    'MAD01': ('Santiago Bernabéu', 40.453, -3.688, 'retractable'),
    'MEL00': ('Melbourne Cricket Ground', -37.820, 144.983, 'outdoors'),
    'MEX00': ('Estadio Banorte', 19.303, -99.150, 'outdoors'),
    'MUN01': ('Allianz Arena', 48.219, 11.625, 'outdoors'),
    'GER00': ('Allianz Arena', 48.219, 11.625, 'outdoors'),
    'FRA00': ('Deutsche Bank Park', 50.069, 8.645, 'retractable'),
    'BER00': ('Olympiastadion', 52.515, 13.239, 'outdoors'),
    'PAR00': ('Stade de France', 48.924, 2.360, 'outdoors'),
    'RIO00': ('Maracanã', -22.912, -43.230, 'outdoors'),
    'SAO00': ('Neo Química Arena', -23.545, -46.474, 'outdoors'),
    'DUB00': ('Croke Park', 53.361, -6.251, 'outdoors'),
}
# Each team's usual home, for a game whose stadium the schedule hasn't named.
TEAM_HOME = {
    'ARI': 'PHO00', 'ATL': 'ATL97', 'BAL': 'BAL00', 'BUF': 'BUF00', 'CAR': 'CAR00', 'CHI': 'CHI98', 'CIN': 'CIN00',
    'CLE': 'CLE00', 'DAL': 'DAL00', 'DEN': 'DEN00', 'DET': 'DET00', 'GB': 'GNB00', 'HOU': 'HOU00', 'IND': 'IND00',
    'JAX': 'JAX00', 'KC': 'KAN00', 'LA': 'LAX01', 'LAC': 'LAX01', 'LV': 'VEG00', 'MIA': 'MIA00', 'MIN': 'MIN01',
    'NE': 'BOS00', 'NO': 'NOR00', 'NYG': 'NYC01', 'NYJ': 'NYC01', 'PHI': 'PHI00', 'PIT': 'PIT00', 'SEA': 'SEA00',
    'SF': 'SFO01', 'TB': 'TAM00', 'TEN': 'NAS00', 'WAS': 'WAS00',
}
STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado',
    'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
    'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
    'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
    'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
}
CONDITIONS = {'clearsky': 'Clear', 'fair': 'Mostly clear', 'partlycloudy': 'Partly cloudy', 'cloudy': 'Cloudy', 'fog': 'Fog',
              'lightrain': 'Light rain', 'rain': 'Rain', 'heavyrain': 'Heavy rain', 'lightrainshowers': 'Light showers',
              'rainshowers': 'Showers', 'heavyrainshowers': 'Heavy showers', 'lightsnow': 'Light snow', 'snow': 'Snow',
              'heavysnow': 'Heavy snow', 'lightsleet': 'Light sleet', 'sleet': 'Sleet', 'heavysleet': 'Heavy sleet',
              'snowshowers': 'Snow showers', 'lightsnowshowers': 'Light snow showers', 'heavysnowshowers': 'Heavy snow showers'}
# Wind (sustained mph) for levels 1-3; gusts this strong add a level.
WIND_LEVELS = (12, 16, 21)
STRONG_GUST_MPH = 35
# Rain (mm an hour) for light and heavy; a chance below this doesn't count.
RAIN_MM, HEAVY_RAIN_MM, LIKELY_PERCENT = 0.5, 2.5, 40
COLD_F = 20

_memory = {}
_lock = threading.Lock()


# ------------------------------------------------------------------ storage

def _store():
    from v2.board import store
    return store


def _cached(key, seconds, load, missing_seconds=None):
    """This server's copy, then the shared store's, then load(). A load that
    found nothing is kept for `missing_seconds` instead."""
    def fresh(at, data):
        return time.time() - at < (missing_seconds if data is None and missing_seconds else seconds)
    with _lock:
        hit = _memory.get(key)
    if hit and fresh(*hit):
        return hit[1]
    try:
        raw = _store().get(key)
        saved = json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001 -- no store: this server's copy only
        saved = None
    if saved and fresh(saved['at'], saved['data']):
        with _lock:
            _memory[key] = (saved['at'], saved['data'])
        return saved['data']
    data = load()
    now = time.time()
    with _lock:
        _memory[key] = (now, data)
    try:
        _store().set(key, json.dumps({'at': now, 'data': data}, separators=(',', ':')),
                     ex=int(missing_seconds if data is None and missing_seconds else seconds))
    except Exception:  # noqa: BLE001
        pass
    return data


def _known(key):
    """A kept value however old, without loading: (found, value)."""
    with _lock:
        hit = _memory.get(key)
    if hit:
        return True, hit[1]
    try:
        raw = _store().get(key)
        saved = json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        saved = None
    return (True, saved['data']) if saved else (False, None)


# ------------------------------------------------------------------ places

def nfl_venue(game):
    """{'name', 'lat', 'lon', 'roof'} for an nflverse schedule row. The roof
    is "dome", "retractable" (taken as shut), "open" or "outdoors"."""
    stadium_id = str(game.get('stadium_id') or '').upper()
    listed = str(game.get('roof') or '').lower()
    home = str(game.get('home') or game.get('home_team') or '').upper()
    neutral = str(game.get('location') or '').lower() == 'neutral'
    known = STADIUMS.get(stadium_id) or (None if neutral else STADIUMS.get(TEAM_HOME.get(home, '')))
    if not known:
        roof = 'dome' if listed in ('dome', 'closed') else 'outdoors' if listed in ('outdoors', 'open') else ''
        return {'name': game.get('stadium') or '', 'lat': None, 'lon': None, 'roof': roof}
    name, lat, lon, roof = known
    if roof == 'retractable' and listed == 'open':
        roof = 'open'
    return {'name': game.get('stadium') or name, 'lat': lat, 'lon': lon, 'roof': roof}


def place_query(city, state='', country=''):
    """What to ask the geocoder for a town: "Tuscaloosa, Alabama, USA"."""
    state = STATES.get(str(state).upper(), state)
    return ', '.join(part for part in (str(city or '').strip(), str(state or '').strip(), str(country or '').strip()) if part)


def town(city, state='', country='', allow_lookup=True):
    """{'lat', 'lon'} for a town, looked up once and kept; None when it
    can't be found (or, with allow_lookup off, hasn't been yet)."""
    query = place_query(city, state, country)
    if not city:
        return None
    key = f'{VERSION}:place:' + re.sub('[^a-z0-9]', '', query.lower())
    if not allow_lookup:
        found, value = _known(key)
        return value if found else None

    def look_up():
        params = {'q': query, 'format': 'jsonv2', 'limit': 1}
        if not country or str(country).upper() in ('USA', 'US', 'UNITED STATES'):
            params['countrycodes'] = 'us'
        found = requests.get(GEOCODER, params=params, headers={'User-Agent': AGENT}, timeout=5).json()
        return {'lat': round(float(found[0]['lat']), 2), 'lon': round(float(found[0]['lon']), 2)} if found else None
    return _cached(key, PLACE_SECONDS, look_up, MISSING_PLACE_SECONDS)


# ------------------------------------------------------------------ forecast

def _number(value):
    return value if isinstance(value, (int, float)) else None


def hourly(lat, lon):
    """Forecast points for a place: hourly for the next two or three days,
    then every six hours."""
    def load():
        response = requests.get(FORECAST, params={'lat': f'{lat:.2f}', 'lon': f'{lon:.2f}'},
                                headers={'User-Agent': AGENT}, timeout=6)
        response.raise_for_status()
        return parse_forecast(response.json())
    return _cached(f'{VERSION}:forecast:{lat:.2f},{lon:.2f}', FORECAST_SECONDS, load)


def parse_forecast(payload):
    points = []
    for item in (payload.get('properties') or {}).get('timeseries') or []:
        data = item.get('data') or {}
        now = (data.get('instant') or {}).get('details') or {}
        span, hours = (data.get('next_1_hours'), 1) if data.get('next_1_hours') else (data.get('next_6_hours'), 6)
        span = span or {}
        details = span.get('details') or {}
        points.append({'time': item.get('time'), 'hours': hours, 'temp': _number(now.get('air_temperature')),
                       'wind': _number(now.get('wind_speed')), 'gust': _number(now.get('wind_speed_of_gust')),
                       'rain': _number(details.get('precipitation_amount')),
                       'chance': _number(details.get('probability_of_precipitation')),
                       'symbol': (span.get('summary') or {}).get('symbol_code')})
    return points


def _when(value):
    try:
        moment = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def conditions(symbol):
    base = re.sub(r'_(day|night|polartwilight)$', '', str(symbol or ''))
    if base in CONDITIONS:
        return CONDITIONS[base]
    words = re.findall(r'heavy|light|rain|sleet|snow|showers|and|thunder|partly|cloudy|fog', base)
    text = ' '.join(words)
    return text[:1].upper() + text[1:] if text else None


def at_kickoff(points, starts_at):
    """The forecast over the game: kickoff to about three and a half hours
    on. None when the forecast doesn't reach it yet."""
    start = _when(starts_at)
    if not start:
        return None
    timed = [(_when(p.get('time')), p) for p in points]
    timed = [(when, p) for when, p in timed if when]
    window = [p for when, p in timed if p['hours'] == 1 and start - timedelta(minutes=30) <= when <= start + timedelta(hours=GAME_HOURS)]
    if not window:
        # Further out the points are six hours apart: the one the game falls in.
        window = [p for when, p in timed if when <= start < when + timedelta(hours=p['hours'])][-1:]
    if not window:
        return None
    first = min(window, key=lambda p: abs((_when(p['time']) - start).total_seconds()))
    winds = [p['wind'] for p in window if p['wind'] is not None]
    gusts = [p['gust'] for p in window if p['gust'] is not None]
    per_hour = [p['rain'] / p['hours'] for p in window if p['rain'] is not None]
    chances = [p['chance'] for p in window if p['chance'] is not None]
    temps = [p['temp'] for p in window if p['temp'] is not None]
    symbols = ' '.join(str(p.get('symbol') or '') for p in window)
    temp = first['temp']
    rain = max(per_hour, default=0.0)
    return {'at': first['time'],
            'tempF': round(temp * 9 / 5 + 32) if temp is not None else None,
            'lowF': round(min(temps) * 9 / 5 + 32) if temps else None,
            'windMph': round(sum(winds) / len(winds) * 2.237) if winds else None,
            'gustMph': round(max(gusts) * 2.237) if gusts else None,
            'rainMm': round(rain, 1), 'chance': round(max(chances)) if chances else None,
            'snow': bool(re.search('snow|sleet', symbols)) or (temp is not None and temp <= 0.5 and rain >= 0.3),
            'thunder': 'thunder' in symbols,
            'conditions': conditions(first.get('symbol'))}


def effects(read):
    """Levels 0-3 for how hard the weather is on passing and on kicking, a
    lean to the run, and the flags the page shows."""
    wind, gust = read.get('windMph') or 0, read.get('gustMph') or 0
    wind_level = sum(wind >= mark for mark in WIND_LEVELS)
    if gust >= STRONG_GUST_MPH:
        wind_level = min(3, wind_level + 1)
    chance = read.get('chance')
    likely = chance is None or chance >= LIKELY_PERCENT
    rain = read.get('rainMm') or 0
    wet = 0
    if likely and read.get('snow') and rain >= 0.2:
        wet = 3 if rain >= 1.0 else 2
    elif likely and (rain >= HEAVY_RAIN_MM or read.get('thunder')):
        wet = 2
    elif likely and rain >= RAIN_MM:
        wet = 1
    low = read.get('lowF') if read.get('lowF') is not None else read.get('tempF')
    cold = 1 if low is not None and low <= COLD_F else 0
    levels = [wind_level, wet, cold]
    passing = min(3, max(levels) + (1 if sum(1 for level in levels if level) >= 2 else 0))
    kicking = min(3, wind_level + (1 if wet >= 2 else 0) + cold)
    flags = []
    if wind_level:
        flags.append({'key': 'wind', 'level': 'high' if wind_level >= 2 else 'medium',
                      'label': f'Wind {wind} mph' + (f', gusts to {gust}' if gust >= wind + 8 else '')})
    if wet:
        label = ('Heavy snow' if wet == 3 else 'Snow') if read.get('snow') else 'Heavy rain' if wet == 2 else 'Rain likely'
        flags.append({'key': 'snow' if read.get('snow') else 'rain', 'level': 'high' if wet >= 2 else 'medium', 'label': label})
    if cold:
        flags.append({'key': 'cold', 'level': 'medium', 'label': f'Freezing: {low}°F'})
    return {'passing': passing, 'kicking': kicking, 'run': 1 if passing >= 2 else 0, 'flags': flags}


def game_weather(venue, starts_at, now=None):
    """What a game shows and the grades read. Never raises."""
    roof = venue.get('roof') or ''
    base = {'venue': venue.get('name') or '', 'roof': roof, 'startsAt': starts_at}
    if roof in ('dome', 'retractable'):
        return {**base, 'covered': True, 'available': True, 'passing': 0, 'kicking': 0, 'run': 0, 'flags': []}
    start, now = _when(starts_at), now or datetime.now(timezone.utc)
    if not start:
        return {**base, 'available': False, 'message': 'Kickoff time unknown.'}
    if start > now + timedelta(days=AHEAD_DAYS):
        return {**base, 'available': False, 'message': 'The forecast for this game is not out yet.'}
    if venue.get('lat') is None or venue.get('lon') is None:
        return {**base, 'available': False, 'pending': bool(venue.get('pending')), 'message': 'Venue location unavailable.'}
    try:
        read = at_kickoff(hourly(venue['lat'], venue['lon']), starts_at)
    except Exception:  # noqa: BLE001 -- forecast outage: the page says so
        return {**base, 'available': False, 'message': 'Weather is temporarily unavailable.'}
    if not read:
        return {**base, 'available': False, 'message': 'The forecast for this game is not out yet.'}
    return {**base, 'available': True, **read, **effects(read), 'credit': CREDIT}


# ------------------------------------------------------------------ slates

def _upcoming(start, now):
    return start and now - timedelta(hours=4) <= start <= now + timedelta(days=AHEAD_DAYS)


def nfl_slate(season, games=None, now=None):
    """Every NFL game in the next week: {games: {game_id: weather}, teams:
    {team: game_id}}."""
    now = now or datetime.now(timezone.utc)

    def build():
        index = games
        if index is None:
            from backend.sports.nfl.finder import games_index
            index = games_index()
        picked = []
        for game_id, game in index.items():
            if str(game.get('season')) != str(season) or game.get('final'):
                continue
            kickoff = game.get('kickoff')
            start = datetime.fromtimestamp(kickoff, timezone.utc) if isinstance(kickoff, (int, float)) else _when(kickoff)
            if _upcoming(start, now):
                picked.append((game_id, game, start.isoformat()))
        out, teams = {}, {}
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = pool.map(lambda item: game_weather(nfl_venue(item[1]), item[2], now), picked)
            for (game_id, game, _start), weather in zip(picked, results):
                out[game_id] = {**weather, 'home': game.get('home'), 'away': game.get('away')}
                for side in ('home', 'away'):
                    teams.setdefault(str(game.get(side) or ''), game_id)
        return {'games': out, 'teams': teams, 'builtAt': now.isoformat(), 'credit': CREDIT, 'version': VERSION}
    if games is not None:
        return build()
    return _cached(f'{VERSION}:nfl:{season}', SLATE_SECONDS, build)


def cfb_venue(venue, allow_lookup=True):
    """An ESPN venue ({'name', 'city', 'state', 'country', 'indoor'}) with
    its place, or pending when its town hasn't been looked up yet."""
    out = {'name': venue.get('name') or '', 'roof': 'dome' if venue.get('indoor') else 'outdoors', 'lat': None, 'lon': None}
    if venue.get('indoor') or not venue.get('city'):
        return out
    try:
        place = town(venue.get('city'), venue.get('state'), venue.get('country'), allow_lookup=allow_lookup)
    except Exception:  # noqa: BLE001 -- geocoder outage: no forecast this time
        place = None
    if place:
        return {**out, **place}
    return {**out, 'pending': not allow_lookup}


def cfb_slate(games, now=None, lookups=LOOKUPS_PER_CALL, focus=None):
    """The college games given (cfb_research's, with their venues):
    {games: {event: weather}, teams: {abbr: event}}. Towns not yet looked
    up are looked up a few a call (the `focus` game's first), the rest
    marked pending."""
    now = now or datetime.now(timezone.utc)
    out, teams, spent = {}, {}, 0
    picked = [game for game in games if _upcoming(_when(game.get('start')), now) and not game.get('completed')]
    picked.sort(key=lambda game: game.get('id') != focus)
    venues = []
    for game in picked:
        venue = game.get('venue') or {}
        place = cfb_venue(venue, allow_lookup=False)
        if place.get('pending') and spent < lookups:
            if spent:
                time.sleep(1.1)  # The free geocoder allows one request a second.
            spent += 1
            place = cfb_venue(venue)
        venues.append(place)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda pair: game_weather(pair[0], pair[1].get('start'), now), zip(venues, picked)))
    for game, weather in zip(picked, results):
        if weather.get('credit'):
            weather = {**weather, 'credit': PLACE_CREDIT}
        out[game['id']] = {**weather, 'home': (game.get('home') or {}).get('abbr'), 'away': (game.get('away') or {}).get('abbr')}
        for side in ('home', 'away'):
            abbr = (game.get(side) or {}).get('abbr')
            if abbr:
                teams.setdefault(abbr, game['id'])
    return {'games': out, 'teams': teams, 'builtAt': now.isoformat(), 'credit': PLACE_CREDIT, 'version': VERSION,
            'pending': sum(1 for weather in out.values() if weather.get('pending'))}


def _save(key, data, seconds):
    now = time.time()
    with _lock:
        _memory[key] = (now, data)
    try:
        _store().set(key, json.dumps({'at': now, 'data': data}, separators=(',', ':')), ex=int(seconds))
    except Exception:  # noqa: BLE001
        pass


def cfb_week(focus=None, now=None):
    """The next week of FBS games' weather, kept half an hour (a minute and
    a half while towns are still being looked up). With `focus`, an event
    whose town is still pending is looked up now."""
    key = f'{VERSION}:cfb'
    with _lock:
        hit = _memory.get(key)
    if not hit:
        try:
            raw = _store().get(key)
            saved = json.loads(raw) if raw else None
            hit = (saved['at'], saved['data']) if saved else None
        except Exception:  # noqa: BLE001
            hit = None
    if hit:
        at, data = hit
        keep = SLATE_SECONDS if not data.get('pending') else 90
        if time.time() - at < keep and not (focus and (data['games'].get(focus) or {}).get('pending')):
            return data
    import cfb_research
    from zoneinfo import ZoneInfo
    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo('America/New_York')).date()
    days = [today + timedelta(days=offset) for offset in range(AHEAD_DAYS)]
    games = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for found in pool.map(lambda day: _quiet(cfb_research.schedule_day, day), days):
            games.extend(found or [])
    data = cfb_slate(games, now=now, focus=focus)
    _save(key, data, SLATE_SECONDS)
    return data


def _quiet(load, *args):
    try:
        return load(*args)
    except Exception:  # noqa: BLE001 -- one day's scoreboard missing
        return None
