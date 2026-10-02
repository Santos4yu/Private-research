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


def headshot_results(html, scoreboard):
    """Read only primitive serialized fields, validated against the visible map.

    The page may contain several maps. Accept exactly one game-ID group whose
    entire roster and K/D/A equal the visible scoreboard; ambiguous data is omitted.
    """
    script = re.search(r'window\.__NUXT__=\(function\(([^)]*)\)\{(.*)\}\((.*)\)\)</script>', html, re.S)
    if not script:
        return {}
    symbols = {}
    for name, literal in zip(script[1].split(','), split_arguments(script[3])):
        try: symbols[name] = json.loads(literal)
        except ValueError: pass
    def resolve(token):
        token = token.strip()
        if token in symbols: return symbols[token]
        try: return json.loads(token)
        except ValueError: return None
    groups = defaultdict(dict)
    body = script[2]
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
            if (player['team'], player['opponent']) != (second['team'], second['opponent']): continue
            values['maps12kills'] = player['kills']+second['kills']
            if 'headshots' in player and 'headshots' in second:
                values['maps12headshots'] = player['headshots']+second['headshots']
        games.append({'gameId': match, 'date': first['date'], 'season': first['date'][:4],
                      'opponent': player['opponent'], 'team': player['team'], 'values': values,
                      'sourceUrl': ROOT+match, 'maps': sorted(group)})
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


def warm(budget=20, limit=2):
    """Rotate active players; bounded backfill; failed reads retain old maps."""
    started = time.monotonic()
    def get(path):
        remaining = budget-(time.monotonic()-started)-1
        if remaining <= 1: raise TimeoutError('Collector budget exhausted')
        return fetch(path, timeout=min(15, remaining))
    jobs, saved = read_entries(JOBS), read_entries(SAVED)
    due = sorted(((key, job) for key, job in jobs.items() if time.time()-job.get('enrolledAt', 0) < 2*86400),
                 key=lambda p: saved.get(p[0], {}).get('checkedAt', 0))
    completed = failed = 0
    for key, job in due[:limit]:
        if time.monotonic()-started >= budget-3: break
        previous = saved.get(key, {})
        if time.time()-previous.get('checkedAt', 0) < 300: continue
        # Cross-worker lock prevents overlapping timers from duplicating requests.
        if command('SET', 'finder:cs2:lock:'+key, '1', 'NX', 'EX', 90) != 'OK': continue
        state = command('HGET', STATE, key)
        entry = json.loads(state) if state else dict(previous)
        entry['checkedAt'] = time.time()
        try:
            paths = entry.get('paths', [])
            if time.time()-entry.get('listedAt', 0) > 6*3600:
                paths = player_maps(get('/players/'+job['slug']+'/maps'), job['slug'])
                entry.update(paths=paths, listedAt=time.time())
            maps = {m['path']: m for m in entry.get('maps', [])}
            # Newest first, but each successful map is permanent, not refetched.
            for item in [p for p in paths if p['path'] not in maps][:2]:
                if time.monotonic()-started >= budget-3: break
                cached = command('HGET', MAPS, item['path'])
                result = json.loads(cached) if cached else map_result(get(item['path']), item['path'], item['date'])
                if not cached: command('HSET', MAPS, item['path'], json.dumps(result, separators=(',', ':')))
                maps[item['path']] = result
                # Persist after every map so a later timeout can't erase progress.
                entry.update(maps=list(maps.values())[-100:], source='bo3', updatedAt=time.time(),
                             games=games_for(job['slug'], maps.values(), paths))
                persist(key, entry)
            completed += 1
        except Exception:
            failed += 1
        finally:
            persist(key, entry)
            command('DEL', 'finder:cs2:lock:'+key)
    return {'completed': completed, 'failed': failed, 'players': len(due)}
