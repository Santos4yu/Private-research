"""Current CS2 projections. Map scopes remain distinct, never inferred."""
import re
import time
import threading
import json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from prizepicks_export_core import _fetch_projection_rows

_cache = {"at": 0, "value": None}
_lock = threading.Lock()
_refresh_lock = threading.Lock()
SNAPSHOT = 'finder:cs2:board:v2'
LINES = 'finder:cs2:lines:v2'


def align_events(rows):
    """Join book labels only when handle, timestamp and both teams agree."""
    def team(value):
        return re.sub(r'[^a-z0-9]', '', re.sub(r'\b(?:esports|gaming|cs2)\b', '', str(value or '').lower()))
    def stamp(row):
        try: return datetime.fromisoformat(row['startsAt'].replace('Z', '+00:00')).timestamp()
        except (ValueError, KeyError): return None
    def book(row): return next(iter(row.get('apps') or [{}])).get('key')
    pp = [r for r in rows if book(r) == 'prizepicks']
    for row in rows:
        if book(row) != 'underdog': continue
        teams = {team(t) for t in re.split(r'\s+vs\.?\s+', row.get('opponent') or '', flags=re.I)}
        matches = [p for p in pp if p['player'].casefold() == row['player'].casefold()
                   and stamp(p) is not None and stamp(p) == stamp(row)
                   and team(p.get('teamAbbr')) and team(p.get('opponent'))
                   and {team(p['teamAbbr']), team(p['opponent'])} == teams]
        identities = {(p['teamAbbr'], p['opponent']) for p in matches}
        if len(identities) == 1:
            row['teamAbbr'], row['opponent'] = identities.pop()
    return rows


def compact(value):
    from finder_history_store import name_key
    histories, rows = {}, []
    for row in value['rows']:
        clean = dict(row)
        history = clean.pop('history', None)
        if history: histories[name_key(row['player'])] = history
        rows.append(clean)
    return {**value, 'rows': rows, 'histories': histories, 'snapshotAt': time.time()}


def response_bytes(value, accept_encoding=''):
    """Transfer full histories without overflowing the function's response limit."""
    import gzip
    raw = json.dumps(value, separators=(',', ':')).encode('utf-8')
    for item in accept_encoding.lower().split(','):
        parts = item.strip().split(';')
        if parts[0] != 'gzip': continue
        try:
            quality = next((float(p.strip()[2:]) for p in parts[1:] if p.strip().startswith('q=')), 1)
        except ValueError:
            continue
        if quality > 0: return gzip.compress(raw, compresslevel=6), 'gzip'
    return raw, None


def publish_saved(value=None):
    from cs2_history import attach, command
    if value is None:
        raw = command('GET', LINES)
        if not raw: return None
        value = json.loads(raw)
    ready = compact(attach(dict(value, rows=[dict(r) for r in value['rows']])))
    command('SET', SNAPSHOT, json.dumps(ready, separators=(',', ':')), 'EX', 900)
    return ready

def build(projections=None, now=None):
    now = time.time() if now is None else now
    if projections is None:
        try:
            projections = _fetch_projection_rows(league="CS2")
        except RuntimeError as error:
            if "no active" not in str(error).lower():
                raise
            projections = []
    rows = []
    for quote in projections:
        try:
            start = datetime.fromisoformat(str(quote.get("start_time") or "").replace("Z", "+00:00")).timestamp()
            line = float(quote["line"])
        except (ValueError, TypeError, KeyError):
            continue
        if start <= now or quote.get("combo") or not quote.get("player") or not quote.get("stat"):
            continue
        stat = quote["stat"]
        rows.append({"id": "pp:"+quote["id"], "projectionId": quote["id"],
                     "player": quote["player"], "playerId": quote.get("player_id"),
                     "headshot": quote.get("headshot"), "teamAbbr": quote.get("team"),
                     "opponent": re.sub(r"\s+MAPS?\s+\d.*$", "", quote.get("description") or "", flags=re.I),
                     "startsAt": datetime.fromtimestamp(start, timezone.utc).isoformat(),
                     "stat": stat, "marketKey": re.sub(r"[^a-z0-9]", "", stat.lower()),
                     "line": line, "modifier": quote.get("odds_type") or "standard",
                     "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None}]})
    return {"rows": rows, "builtAt": datetime.now(timezone.utc).isoformat(),
            "source": "prizepicks", "version": "cs2-board-v1", "historyAvailable": False}

def board(force=False):
    from cs2_history import command
    if not force:
        try:
            raw = command('GET', SNAPSHOT)
            ready = json.loads(raw) if raw else None
            if ready and time.time()-ready.get('snapshotAt', 0) < 900 and time.time()-ready.get('lineUpdatedAt', 0) < 900:
                # Expired events never survive a saved-board hit.
                ready['rows'] = [r for r in ready['rows'] if datetime.fromisoformat(r['startsAt'].replace('Z', '+00:00')).timestamp() > time.time()]
                return ready
        except Exception:
            pass
    with _lock:
        value = _cache['value'] if not force and time.time()-_cache['at'] < 120 else None
    with _refresh_lock:
        value = value or _refresh(force)
    try:
        command('SET', LINES, json.dumps(value, separators=(',', ':')), 'EX', 900)
        return publish_saved(value)
    except Exception:
        from cs2_history import attach
        return compact(attach(dict(value, rows=[dict(r) for r in value['rows']])))

def _refresh(force=False):
    with _lock:
        if not force and _cache["value"] is not None and time.time()-_cache["at"] < 120:
            return _cache["value"]
    from cs2_underdog import fetch as underdog
    def prizepicks():
        return build(_fetch_projection_rows(force=force, league="CS2"))
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures={'prizepicks':pool.submit(prizepicks),'underdog':pool.submit(underdog)}
        results,errors,stale={},[],[]
        from cs2_history import command
        for source,future in futures.items():
            key='finder:cs2:provider:'+source
            try:
                results[source]=future.result()
                try: command('SET',key,json.dumps({'at':time.time(),'data':results[source]}),'EX',900)
                except Exception: pass
            except Exception:
                errors.append(source)
                try:
                    raw=command('GET',key)
                    saved=json.loads(raw) if raw else None
                    if saved and 0<=time.time()-saved['at']<900:
                        data=saved['data']
                        rows=data['rows'] if isinstance(data,dict) else data
                        active=[{**r,'quoteAsOf':saved['at'],'staleQuote':True} for r in rows if datetime.fromisoformat(r['startsAt'].replace('Z','+00:00')).timestamp()>time.time()]
                        if active:
                            results[source]={**data,'rows':active} if isinstance(data,dict) else active
                            stale.append(source)
                except Exception: pass
    if not results:
        raise RuntimeError('CS2 providers unavailable')
    value=results.get('prizepicks') or build([])
    value['rows']+=results.get('underdog',[])
    align_events(value['rows'])
    value['sources']=list(results)
    value['unavailableSources']=errors
    value['staleSources']=stale
    value['lineUpdatedAt']=min([time.time()]+[r['quoteAsOf'] for r in value['rows'] if r.get('staleQuote')])
    with _lock:
        _cache.update(at=time.time(), value=value)
    return value
