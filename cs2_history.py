"""Free public BO3 results; no browser scripts are executed or private APIs used.

Collection runs on the existing timer. Request handlers only read saved results.
Incomplete maps and ambiguous identities never become zero-valued game logs.
"""
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
import requests
from concurrent.futures import ThreadPoolExecutor
from finder_history_store import command, name_key

ROOT = 'https://bo3.gg'
JOBS = 'finder:cs2:jobs:v1'
SAVED = 'finder:cs2:results:v1'
MAPS = 'finder:cs2:maps:v1'
STATE = 'finder:cs2:backfill:v1'
# This nickname's letter-O spelling is used by the posted-line feed.
ALIASES = {'osamas': '0samas'}
_memory = {}


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children).strip()

    def find(self, cls=None, tag=None):
        for child in self.children:
            if isinstance(child, Node):
                if (not cls or cls in child.attrs.get('class', '').split()) and (not tag or child.tag == tag):
                    yield child
                yield from child.find(cls, tag)


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in ('img', 'br', 'meta', 'link', 'input', 'hr', 'source', 'wbr', 'area', 'base', 'embed', 'param', 'track'):
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def fetch(path, timeout=10):
    if not re.fullmatch(r'/(?:players/[a-z0-9_-]+/maps|matches/[a-z0-9_-]+/[a-z0-9_-]+)', path):
        raise ValueError('Invalid public result path')
    response = requests.get(ROOT+path, timeout=(min(3, timeout/3), timeout*2/3))
    response.raise_for_status()
    if len(response.content) > 4_000_000:
        raise ValueError('Oversized results page')
    response.encoding = 'utf-8'
    return response.text


def player_maps(html, slug):
    tree = Tree(html).root
    heading = next(tree.find(tag='h1'), None)
    if not heading or name_key(heading.text()) != name_key(slug):
        raise ValueError('Player identity not verified')
    maps = []
    for node in tree.find('table-row', 'a'):
        path = node.attrs.get('href', '')
        date = re.search(r'-(\d{2})-(\d{2})-(\d{4})/', path)
        if not date or not path.startswith('/matches/'):
            continue
        teams = [n.text() for n in node.find('team-name')]
        if len(teams) != 2:
            continue
        day, month, year = date.groups()
        try:
            played = datetime(int(year), int(month), int(day), tzinfo=timezone.utc).date().isoformat()
        except ValueError:
            continue
        maps.append({'path': path, 'date': played, 'teams': teams})
    return list({m['path']: m for m in maps}.values())[:80]


def integer(node, cls):
    cell = next(node.find(cls), None)
    value = cell.text() if cell else ''
    return int(value) if re.fullmatch(r'\d+', value) else None


def split_arguments(value):
    """Split literal arguments, respecting strings/containers; never eval JS."""
    start = depth = 0
    quote = None
    escape = False
    for i, c in enumerate(value):
        if quote:
            if escape: escape = False
            elif c == '\\': escape = True
            elif c == quote: quote = None
        elif c in ('"', "'"): quote = c
        elif c in '[{(': depth += 1
        elif c in ']})': depth -= 1
        elif c == ',' and depth == 0:
            yield value[start:i]
            start = i+1
    yield value[start:]


def serialized_literals(html):
    script = re.search(r'window\.__NUXT__=\(function\(([^)]*)\)\{(.*)\}\((.*)\)\)</script>', html, re.S)
    if not script: return '', {}
    symbols = {}
    for name, literal in zip(script[1].split(','), split_arguments(script[3])):
        try: symbols[name] = json.loads(literal)
        except ValueError: pass
    return script[2], symbols


def literal_array(body, start):
    depth = 0
    quote = None
    escaped = False
    for i in range(start, len(body)):
        c = body[i]
        if quote:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == quote: quote = None
        elif c in ('"', "'"): quote = c
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: return body[start+1:i]
    return ''


def listed_results(html, slug, paths):
    """One player page already contains explicit map numbers and real K/D/A.

    Validate every literal result against its visible row before accepting it.
    This makes kills histories available in one source request per player;
    exact headshots are added separately from completed full scoreboards.
    """
    body, symbols = serialized_literals(html)
    marker = '"widget-player-maps-results-'+slug+'"'
    at = body.find(marker)
    if at < 0: return []
    at = body.find('results:[', at)
    if at < 0: return []
    visible = {}
    for row in Tree(html).root.find('table-row', 'a'):
        visible[row.attrs.get('href')] = {k: integer(row, k) for k in ('kills', 'deaths', 'assists')}
    indexed = {p['path']: p for p in paths}
    def resolve(token):
        if token in symbols: return symbols[token]
        try: return json.loads(token)
        except ValueError: return None
    accepted = []
    for obj in split_arguments(literal_array(body, at+8)):
        if not obj.startswith('{slug:'): break
        fields = {k: v for k, _, v in (pair.partition(':') for pair in split_arguments(obj[1:-1]))}
        match = resolve(fields.get('slug', ''))
        map_name = resolve(fields.get('map_name', ''))
        number = resolve(fields.get('game_number', ''))
        start = resolve(fields.get('start_date', ''))
        winner, loser = (resolve(fields.get(k, '')) for k in ('winner_clan_score', 'loser_clan_score'))
        if type(winner) is not int or type(loser) is not int or winner < 13 or winner-loser < 2: continue
        if not isinstance(match, str) or not isinstance(map_name, str) or type(number) is not int or not 1 <= number <= 5: continue
        map_slug = map_name.removeprefix('de_')
        path = '/matches/'+match+'/'+map_slug
        info = indexed.get(path)
        actual = visible.get(path)
        if not info or not actual: continue
        values = None
        for kind in ('advanced', 'basic'):
            candidate = {k: resolve(fields.get(kind+'_'+k, '')) for k in ('kills', 'deaths', 'assists')}
            if all(type(v) is int and v >= 0 for v in candidate.values()) and candidate == actual:
                values = candidate
                break
        if values is None: continue
        try:
            if datetime.fromisoformat(start.replace('Z', '+00:00')).timestamp() > time.time(): continue
        except (ValueError, AttributeError): continue
        info['date'] = start
        # The list does not identify which team this player represented in an
        # old series. Keep a matchup label, never guess an opponent or H2H.
        accepted.append({'path': path, 'date': start, 'mapNumber': number, 'map': map_slug,
                         'players': {slug: {**values, 'team': None, 'opponent': ' / '.join(info['teams'])}},
                         'listed': True})
    return accepted


def headshot_results(html, scoreboard):
    """Read only primitive serialized fields, validated against the visible map.

    The page may contain several maps. Accept exactly one game-ID group whose
    entire roster and K/D/A equal the visible scoreboard; ambiguous data is omitted.
    """
    body, symbols = serialized_literals(html)
    if not body:
        return {}
    def resolve(token):
        token = token.strip()
        if token in symbols: return symbols[token]
        try: return json.loads(token)
        except ValueError: return None
    groups = defaultdict(dict)
    for match in re.finditer(r'([\w$]+)\.kills=([^;]+);', body):
        var = match[1]
        # All assignments for this stats object precede the next object's id.
        start = body.rfind(var+'.id=', 0, match.start())
        if start < 0: continue
        end = re.search(r';[\w$]+\.id=', body[match.end():])
        block = body[start:match.end()+end.start()+1] if end else body[start:]
        def field(key):
            m = re.search(re.escape(var)+r'\.'+key+r'=([^;]+);', block)
            return resolve(m[1]) if m else None
        player = re.search(r'player:\{id:[^,]+,slug:([^,}]+),', block)
        slug = resolve(player[1]) if player else None
        game = field('game_id')
        kills, deaths, assists, hs = (field(k) for k in ('kills', 'death', 'assists', 'headshots'))
        if type(game) is not int or not isinstance(slug, str) or not all(type(n) is int and n >= 0 for n in (kills, deaths, assists, hs)) or hs > kills:
            continue
        groups[game][slug] = {'kills': kills, 'deaths': deaths, 'assists': assists, 'headshots': hs}
    matches = [g for g in groups.values() if set(g) == set(scoreboard) and all(
        all(g[s][key] == row[key] for key in ('kills', 'deaths', 'assists')) for s, row in scoreboard.items())]
    return {s: r['headshots'] for s, r in matches[0].items()} if len(matches) == 1 else {}


def map_result(html, path, date):
    root = Tree(html).root
    # Scheduled/live scoreboards are not settled results.
    if not any(n.text() == 'Ended' for n in root.find('status')):
        raise ValueError('Map not completed')
    headers = [n.text() for n in root.find('o-widget__header') if 'Scoreboard' in n.text()]
    scope = [re.search(r'^(.*?) Scoreboard (.*?) \(M(\d+)\)$', h) for h in headers]
    if len(scope) != 2 or not all(scope) or scope[0][3] != scope[1][3]:
        raise ValueError('Map order unavailable')
    teams = [m[1] for m in scope]
    players = {}
    for board in root.find('c-widget-match-scoreboard'):
        h = next(board.find('o-widget__header'), None)
        if not h: continue
        team = next((t for t in teams if h.text().startswith(t+' Scoreboard ')), None)
        if not team: continue
        for row in board.find('table-row'):
            links = [a for a in row.find(tag='a') if re.fullmatch(r'/players/[a-z0-9_-]+', a.attrs.get('href', ''))]
            if len(links) != 1: continue
            values = {key: integer(row, key) for key in ('kills', 'deaths', 'assists')}
            if any(v is None for v in values.values()): continue
            slug = links[0].attrs['href'].split('/')[-1]
            players[slug] = {**values, 'team': team, 'opponent': next(t for t in teams if t != team)}
    if len(players) != 10:
        raise ValueError('Incomplete scoreboard')
    hs = headshot_results(html, players)
    for slug, count in hs.items(): players[slug]['headshots'] = count
    return {'path': path, 'date': date, 'mapNumber': int(scope[0][3]), 'map': scope[0][2], 'players': players}


def games_for(slug, maps, paths=()):
    series = defaultdict(dict)
    for m in maps:
        if slug in m['players']:
            series[m['path'].rsplit('/', 1)[0]][m['mapNumber']] = m
    games = []
    for match, group in series.items():
        first = group.get(1)
        if not first: continue
        player = first['players'][slug]
        values = {'map1kills': player['kills']}
        if 'headshots' in player: values['map1headshots'] = player['headshots']
        if 2 in group:
            second = group[2]['players'][slug]
            # Don't join mismatched rosters/opponents across maps.
            compatible = (player['team'], player['opponent']) == (second['team'], second['opponent']) or first.get('listed') or group[2].get('listed')
            if compatible:
                values['maps12kills'] = player['kills']+second['kills']
                if 'headshots' in player and 'headshots' in second:
                    values['maps12headshots'] = player['headshots']+second['headshots']
        games.append({'gameId': match, 'date': first['date'], 'season': first['date'][:4],
                      'opponent': player['opponent'], 'team': player['team'], 'values': values,
                      'sourceUrl': ROOT+match, 'maps': sorted(group),
                      'mapDetails': [{'number': n, 'map': m['map'], **m['players'][slug]}
                                     for n, m in sorted(group.items())]})
    order = {}
    for i, p in enumerate(paths):
        order.setdefault(p['path'].rsplit('/', 1)[0], i)
    # Source page is newest first; preserve ordering for same-day series.
    return sorted(games, key=lambda g: (g['date'], -order.get(g['gameId'], 9999), g['gameId']))[-40:]


def read_entries(key):
    raw = command('HGETALL', key) or []
    pairs = raw.items() if isinstance(raw, dict) else zip(raw[::2], raw[1::2])
    result = {}
    for k, v in pairs:
        try: result[k] = json.loads(v)
        except (ValueError, TypeError): continue
    return result


def persist(key, entry):
    command('HSET', STATE, key, json.dumps(entry, separators=(',', ':')))
    display = {k: entry[k] for k in ('games', 'updatedAt', 'source', 'checkedAt') if k in entry}
    display['listingReady'] = entry.get('listParserVersion') == 2
    command('HSET', SAVED, key, json.dumps(display, separators=(',', ':')))
    _memory[key] = display


def attach(board):
    """Fast saved-data read; no result-source requests on the Finder path."""
    try: saved = read_entries(SAVED)
    except Exception: saved = dict(_memory)
    fields = {}
    for row in board['rows']:
        key = name_key(row['player'])
        slug = ALIASES.get(key, str(row['player']).lower().strip())
        if not re.fullmatch('[a-z0-9_-]+', slug): continue
        fields[key] = json.dumps({'player': row['player'], 'slug': slug, 'enrolledAt': time.time()})
        entry = saved.get(key)
        if entry and entry.get('games'):
            row['history'] = {k: entry[k] for k in ('games', 'updatedAt', 'source')}
    if fields:
        try: command('HSET', JOBS, *[v for pair in fields.items() for v in pair])
        except Exception: pass
    board['historyAvailable'] = any(r.get('history') for r in board['rows'])
    return board


def warm(budget=20, limit=12, concurrency=3, max_maps=6, force=False, listing_only=False):
    """Rotate active players; bounded backfill; failed reads retain old maps."""
    started = time.monotonic()
    def get(path):
        remaining = budget-(time.monotonic()-started)-1
        if remaining <= 1: raise TimeoutError('Collector budget exhausted')
        return fetch(path, timeout=min(15, remaining))
    jobs, saved = read_entries(JOBS), read_entries(SAVED)
    due = sorted(((key, job) for key, job in jobs.items() if time.time()-job.get('enrolledAt', 0) < 2*86400),
                 key=lambda p: (bool(saved.get(p[0], {}).get('listingReady')), saved.get(p[0], {}).get('checkedAt', 0)))
    def collect(pair):
        key, job = pair
        if time.monotonic()-started >= budget-3: return (0, 0)
        previous = saved.get(key, {})
        if not force and time.time()-previous.get('checkedAt', 0) < 60: return (0, 0)
        # Cross-worker lock prevents overlapping timers from duplicating requests.
        if command('SET', 'finder:cs2:lock:'+key, '1', 'NX', 'EX', max(90, int(budget)+30)) != 'OK': return (0, 0)
        state = command('HGET', STATE, key)
        entry = json.loads(state) if state else dict(previous)
        entry['checkedAt'] = time.time()
        errors = 0
        first_listing = entry.get('listParserVersion') != 2
        try:
            paths = entry.get('paths', [])
            maps = {m['path']: m for m in entry.get('maps', [])}
            if time.time()-entry.get('listedAt', 0) > 6*3600 or entry.get('listParserVersion') != 2:
                html = get('/players/'+job['slug']+'/maps')
                paths = player_maps(html, job['slug'])
                for m in listed_results(html, job['slug'], paths):
                    maps.setdefault(m['path'], m)
                entry.update(paths=paths, listedAt=time.time(), listParserVersion=2)
                entry.update(maps=list(maps.values())[-100:], source='bo3', updatedAt=time.time(), games=games_for(job['slug'], maps.values(), paths))
                persist(key, entry)
            if listing_only or first_listing: return (1, 0)
            # Newest first, but each successful map is permanent, not refetched.
            attempts = entry.setdefault('attempts', {})
            pending = [p for p in paths if (p['path'] not in maps or 'headshots' not in maps[p['path']]['players'].get(job['slug'], {})) and
                       (force or time.time()-attempts.get(p['path'], 0) >= 300)]
            for item in pending[:max_maps]:
                if time.monotonic()-started >= budget-3: break
                try:
                    cached = command('HGET', MAPS, item['path'])
                    if cached:
                        result = json.loads(cached)
                    else:
                        claim = command('SET', 'finder:cs2:maplock:'+item['path'], '1', 'NX', 'EX', 45)
                        if claim != 'OK': continue
                        try:
                            result = map_result(get(item['path']), item['path'], item['date'])
                            command('HSET', MAPS, item['path'], json.dumps(result, separators=(',', ':')))
                        finally:
                            command('DEL', 'finder:cs2:maplock:'+item['path'])
                except Exception:
                    attempts[item['path']] = time.time()
                    errors += 1
                    continue
                maps[item['path']] = result
                # Persist after every map so a later timeout can't erase progress.
                entry.update(maps=list(maps.values())[-100:], source='bo3', updatedAt=time.time(),
                             games=games_for(job['slug'], maps.values(), paths))
                persist(key, entry)
            return (1, errors)
        except Exception:
            return (0, 1)
        finally:
            persist(key, entry)
            command('DEL', 'finder:cs2:lock:'+key)
    # Small bounded concurrency; cached maps prevent repeated source requests.
    with ThreadPoolExecutor(max_workers=max(1, min(3, concurrency))) as pool:
        outcomes = list(pool.map(collect, due[:limit]))
    shared = fan_out(jobs)
    try:
        from cs2_board import publish_saved
        publish_saved()
    except Exception:
        pass
    return {'completed': sum(c for c, _ in outcomes), 'failed': sum(f for _, f in outcomes),
            'players': len(due), 'covered': shared['covered'], 'games': shared['games']}


def fan_out(jobs=None):
    """One verified ten-player scoreboard supplies all those players' logs.

    Only results for positively matched source slugs are shared. This avoids
    collecting the same series separately for five teammates and opponents.
    """
    jobs = read_entries(JOBS) if jobs is None else jobs
    maps, saved, states = read_entries(MAPS), read_entries(SAVED), read_entries(STATE)
    fields = {}
    for key, job in jobs.items():
        if time.time()-job.get('enrolledAt', 0) > 2*86400: continue
        paths = states.get(key, {}).get('paths', [])
        combined = {m['path']: m for m in states.get(key, {}).get('maps', [])}
        combined.update(maps)
        games = games_for(job['slug'], combined.values(), paths)
        if not games: continue
        prior = saved.get(key, {})
        # Preserve histories already collected; merge scopes as map 2 arrives.
        merged = {g['gameId']: g for g in prior.get('games', [])}
        for game in games:
            old = merged.get(game['gameId'], {})
            merged[game['gameId']] = {**old, **game, 'values': {**old.get('values', {}), **game['values']}}
        order = {}
        for i, p in enumerate(paths): order.setdefault(p['path'].rsplit('/', 1)[0], i)
        entry = {**prior, 'games': sorted(merged.values(), key=lambda g:(g['date'], -order.get(g['gameId'], 9999), g['gameId']))[-40:],
                 'source': 'bo3', 'updatedAt': time.time()}
        fields[key] = json.dumps(entry, separators=(',', ':'))
        saved[key] = entry
    if fields: command('HSET', SAVED, *[v for pair in fields.items() for v in pair])
    return {'covered': sum(bool(v.get('games')) for k, v in saved.items() if k in jobs),
            'games': sum(len(v.get('games', [])) for k, v in saved.items() if k in jobs)}
