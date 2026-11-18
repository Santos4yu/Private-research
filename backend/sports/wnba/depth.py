"""Dated ESPN depth charts for the NBA: PG / SG / SF / PF / C (Nov 18).

ESPN's box scores only say G, F or C. The five spots come from ESPN's team
depth charts, which change through a season, so they are kept with the time
each was read and every game uses the chart read before it tipped off --
never a later one. Two sources feed the same store:

- ESPN itself, read by Vercel's cron twice a day (sync_live);
- SportsDataverse's daily archive of the same ESPN charts (its
  espn_nba_depthcharts release), read by the "NBA depth chart sync"
  workflow on GitHub's machines -- Parquet is too heavy to read here -- and
  posted to the site (import_snapshots). That brings this season's history
  from Sep 8 and fills any day the live read missed. The two agreed on all
  150 team-spots when tested (Nov 18).

Placing a player (place): his highest listing (lowest depth number) is his
spot. Listed equally high at two spots, ESPN's own G / F / C label for him
settles it when it fits only one; otherwise, or when he is on no chart, or
the newest chart before the game is over STALE_MINUTES old, he is left
unplaced. Never guessed from his stats, and never counted at two spots.

The store is one gzip record a season (league._encode): every chart once by
its hash, and each team's reads as [minute, hash] (minute = Unix minutes,
UTC), every read kept so a chart's age at a game is known.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from bisect import bisect_left
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

from . import league

SLOTS = ("pg", "sg", "sf", "pf", "c")
FAMILY = {"pg": "G", "sg": "G", "sf": "F", "pf": "F", "c": "C"}
SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team}/depthcharts"
CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{season}/teams/{team}/depthcharts"
TIMEOUT = (3, 7)
WORKERS = 15
KEY = "krazy_data:nba:v1:depth:{season}"
# A chart counts for a game only when read at least this long before the
# scheduled tip, and no longer than STALE_MINUTES before it.
TIP_MARGIN_MINUTES = 15
STALE_MINUTES = 72 * 60
# The store's live-read log, newest last.
KEEP_CHECKS = 120
SOURCES = ("espn", "sportsdataverse")
_ATHLETE = re.compile(r"/athletes/(\d+)")
_memory: dict = {}
MEMORY_SECONDS = 60


def minute_of(value) -> int | None:
    """Unix minutes (UTC) of an ISO time ("2026-11-18T00:30Z") or epoch seconds."""
    if isinstance(value, (int, float)):
        return int(value // 60)
    try:
        return int(datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() // 60)
    except (TypeError, ValueError):
        return None


def iso_of(minute: int | None) -> str | None:
    return None if minute is None else datetime.fromtimestamp(minute * 60, timezone.utc).isoformat(timespec="minutes")


def chart_hash(chart: dict) -> str:
    return hashlib.sha1(json.dumps(chart, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:12]


def valid_chart(chart) -> dict | None:
    """{slot: [athlete ids in depth order]} with all five spots, ids as digit
    strings (each once a spot), or None."""
    if not isinstance(chart, dict):
        return None
    clean = {}
    for slot in SLOTS:
        ids = []
        for aid in chart.get(slot) or []:
            aid = str(aid)
            if aid.isdigit() and aid not in ids:
                ids.append(aid)
        if not ids:
            return None
        clean[slot] = ids
    return clean


def parse(payload) -> dict:
    """{slot: [(rank, athlete id, name)]} from either of ESPN's shapes: the
    site API's depthchart[].positions or the core API's items[].positions
    (athletes as $ref links). The first group with positions is the chart."""
    payload = payload if isinstance(payload, dict) else {}
    groups = payload.get("depthchart") or payload.get("items") or []
    if isinstance(groups, dict):
        groups = [groups]
    for group in groups:
        chart = {}
        for key, entry in ((group or {}).get("positions") or {}).items():
            entry = entry if isinstance(entry, dict) else {}
            abbr = str((entry.get("position") or {}).get("abbreviation") or "").lower()
            slot = abbr if abbr in SLOTS else str(key).lower()
            if slot not in SLOTS:
                continue
            for index, athlete in enumerate(entry.get("athletes") or []):
                athlete = athlete if isinstance(athlete, dict) else {}
                inner = athlete.get("athlete") if isinstance(athlete.get("athlete"), dict) else {}
                aid = athlete.get("id") or inner.get("id")
                if not aid:
                    found = _ATHLETE.search(str(inner.get("$ref") or athlete.get("$ref") or ""))
                    aid = found.group(1) if found else None
                if not aid:
                    continue
                rank = athlete.get("rank")
                rank = int(rank) if str(rank).isdigit() else index + 1
                chart.setdefault(slot, []).append((rank, str(aid), athlete.get("displayName") or inner.get("displayName") or ""))
        if chart:
            return chart
    return {}


def ids_of(parsed: dict) -> dict:
    """parse()'s chart as {slot: [ids in depth order]}."""
    return {slot: [aid for _, aid, _ in sorted(rows, key=lambda row: row[0])] for slot, rows in parsed.items()}


def place(chart: dict, labels: dict) -> dict:
    """athlete id -> (slot or None, how, candidate slots) for one chart of
    {slot: [ids in depth order]}: "listed" (one spot at his highest listing),
    "label" (a tie there settled by ESPN's G / F / C for him), "tie" (still
    tied: unplaced; the candidates are the tied spots). `labels`: id -> G/F/C."""
    listings = {}
    for slot in SLOTS:
        for rank, aid in enumerate(chart.get(slot) or [], start=1):
            listings.setdefault(aid, []).append((rank, slot))
    placed = {}
    for aid, found in listings.items():
        top = min(rank for rank, _ in found)
        tops = tuple(sorted({slot for rank, slot in found if rank == top}, key=SLOTS.index))
        if len(tops) == 1:
            placed[aid] = (tops[0], "listed", tops)
            continue
        fit = [slot for slot in tops if FAMILY[slot] == labels.get(aid)]
        placed[aid] = (fit[0], "label", tops) if len(fit) == 1 else (None, "tie", tops)
    return placed


# ------------------------------------------------------------------ store

def empty(season: int) -> dict:
    return {"season": season, "charts": {}, "snaps": {}, "checks": [], "sources": {}, "updatedAt": None}


def load(season: int, fresh: bool = False) -> dict:
    hit = _memory.get(season)
    if hit and not fresh and time.time() - hit[0] < MEMORY_SECONDS:
        return hit[1]
    from v2.board import store
    raw = store.get(KEY.format(season=season))
    value = league._decode(raw) if raw else empty(season)
    _memory[season] = (time.time(), value)
    return value


def save(season: int, value: dict) -> bool:
    from v2.board import store
    ok = bool(store.set(KEY.format(season=season), league._encode(value)))
    if ok:
        _memory[season] = (time.time(), value)
    return ok


def merge(value: dict, snapshots, source: str) -> int:
    """Add reads [(minute, team, chart)] to the store; returns how many were
    new. A read already kept for that team and minute is skipped."""
    added = 0
    for minute, abbr, chart in snapshots:
        chart = valid_chart(chart)
        if chart is None or not isinstance(minute, int) or not abbr:
            continue
        digest = chart_hash(chart)
        value["charts"].setdefault(digest, chart)
        reads = value["snaps"].setdefault(abbr, [])
        if any(read[0] == minute for read in reads):
            continue
        reads.append([minute, digest])
        added += 1
    for reads in value["snaps"].values():
        reads.sort(key=lambda read: read[0])
    if added:
        value["sources"][source] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        value["updatedAt"] = value["sources"][source]
    return added


# ------------------------------------------------------------------ sources

def _get(url: str):
    try:
        response = requests.get(url, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        return (response.json() if response.status_code == 200 else None), response.status_code
    except Exception as exc:  # noqa: BLE001 -- reported, never raised
        return None, type(exc).__name__


def fetch_team(team_id: str, season: int) -> tuple[dict | None, str, list]:
    """One team's chart from ESPN now: ({slot: ids} or None, source, tries)."""
    tries = []
    for name, url in (("site", SITE.format(team=team_id)), ("core", CORE.format(season=season, team=team_id))):
        payload, status = _get(url)
        tries.append([name, status])
        chart = valid_chart(ids_of(parse(payload)))
        if chart:
            return chart, name, tries
    return None, "", tries


def sync_live(season: int | None = None) -> dict:
    """Read every team's chart from ESPN now and keep it (Vercel's cron).
    A team that doesn't answer with all five spots is logged as missing and
    keeps its last chart; nothing is dropped."""
    season = season or league.current_season(league="nba")
    teams = league.team_directory("nba")
    now = int(time.time() // 60)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = dict(zip(sorted(teams), pool.map(lambda abbr: fetch_team(teams[abbr]["id"], season), sorted(teams))))
    value = load(season, fresh=True)
    added = merge(value, [(now, abbr, chart) for abbr, (chart, _, _) in results.items() if chart], "espn")
    missing = sorted(abbr for abbr, (chart, _, _) in results.items() if not chart)
    value["checks"] = (value.get("checks") or []) + [[now, "espn", len(results) - len(missing), missing]]
    value["checks"] = value["checks"][-KEEP_CHECKS:]
    saved = save(season, value)
    return {"at": iso_of(now), "season": season, "teams": len(results), "missing": missing, "added": added, "saved": saved,
            "sources": sorted({source for _, source, _ in results.values() if source}),
            "tries": {abbr: tries for abbr, (chart, _, tries) in results.items() if not chart}}


def import_snapshots(body: dict, season: int | None = None) -> dict:
    """Keep SportsDataverse's reads, posted by the sync workflow:
    {season, charts: {hash: chart}, snaps: [[minute, team, hash]], updated}.
    Every chart's hash is worked out again here and has to match; a read
    for a team we don't know, from before the season, or from the future is
    turned away."""
    season = season or league.current_season(league="nba")
    if int(body.get("season") or 0) != season:
        return {"error": f"Only the current season ({season}) is taken.", "added": 0}
    teams = set(league.team_directory("nba"))
    charts = {}
    for digest, chart in (body.get("charts") or {}).items():
        chart = valid_chart(chart)
        if chart and chart_hash(chart) == digest:
            charts[digest] = chart
    first = minute_of(datetime(season - 1, 8, 1, tzinfo=timezone.utc).timestamp())
    now = int(time.time() // 60)
    snapshots, refused = [], 0
    for row in body.get("snaps") or []:
        try:
            minute, abbr, digest = int(row[0]), str(row[1]), str(row[2])
        except (TypeError, ValueError, IndexError):
            refused += 1
            continue
        if abbr not in teams or digest not in charts or not first <= minute <= now + 10:
            refused += 1
            continue
        snapshots.append((minute, abbr, charts[digest]))
    value = load(season, fresh=True)
    added = merge(value, snapshots, "sportsdataverse")
    if body.get("updated"):
        value["sdvUpdated"] = str(body["updated"])[:40]
    saved = save(season, value) if added or body.get("updated") else True
    return {"season": season, "received": len(snapshots) + refused, "refused": refused, "added": added, "saved": saved,
            "teams": len({abbr for _, abbr, _ in snapshots})}


# ------------------------------------------------------------------ reading

class Index:
    """The store, ready to answer "which chart did this team have before
    this game?" quickly. Built once per stored-season answer."""

    def __init__(self, value: dict):
        self.value = value or {}
        self.charts = self.value.get("charts") or {}
        self.reads = {abbr: ([read[0] for read in reads], [read[1] for read in reads])
                      for abbr, reads in (self.value.get("snaps") or {}).items()}

    @property
    def version(self) -> str:
        return f"{self.value.get('updatedAt')}|{sum(len(minutes) for minutes, _ in self.reads.values())}"

    def __bool__(self) -> bool:
        return bool(self.reads)

    def chart_before(self, abbr: str, tip: int | None):
        """(hash, minute read, status) of the newest chart read before `tip`:
        status "ok", "stale" (older than STALE_MINUTES) or "none"."""
        minutes, hashes = self.reads.get(abbr) or ([], [])
        if tip is None or not minutes:
            return None, None, "none"
        index = bisect_left(minutes, tip - TIP_MARGIN_MINUTES) - 1
        if index < 0:
            return None, None, "none"
        if tip - minutes[index] > STALE_MINUTES:
            return None, minutes[index], "stale"
        return hashes[index], minutes[index], "ok"

    def spots(self, abbr: str, tip: int | None, labels: dict) -> tuple[dict, str]:
        """({athlete id: (slot or None, how, candidates)}, status) for `abbr`'s
        players in a game tipping at `tip`. Without a usable chart nobody is
        placed (status "none" or "stale")."""
        digest, _, status = self.chart_before(abbr, tip)
        if digest is None:
            return {}, status
        return place(self.charts.get(digest) or {}, labels), status

    def status(self) -> dict:
        """When the store was last fed, its newest read and the teams read in the last 36 hours."""
        newest = max((minutes[-1] for minutes, _ in self.reads.values() if minutes), default=None)
        now = int(time.time() // 60)
        recent = sorted(abbr for abbr, (minutes, _) in self.reads.items() if minutes and now - minutes[-1] <= 36 * 60)
        first = min((minutes[0] for minutes, _ in self.reads.values() if minutes), default=None)
        return {"updatedAt": self.value.get("updatedAt"), "newest": iso_of(newest), "first": iso_of(first),
                "teamsCurrent": len(recent), "stale": newest is None or now - newest > 36 * 60,
                "sources": self.value.get("sources") or {}, "sdvUpdated": self.value.get("sdvUpdated"),
                "lastCheck": (self.value.get("checks") or [None])[-1]}


def index_for(season: int) -> Index | None:
    """The season's Index, or None when nothing is kept (older seasons)."""
    try:
        value = load(season)
    except Exception:  # noqa: BLE001 -- storage trouble: no five-spot view, G / F / C unaffected
        return None
    found = Index(value)
    return found if found else None


def synced_within(minutes: int, season: int | None = None) -> bool:
    """Whether a live read was kept in the last `minutes` (a cron call by
    headers alone is held to one a window)."""
    try:
        checks = load(season or league.current_season(league="nba"), fresh=True).get("checks") or []
    except Exception:  # noqa: BLE001
        return False
    return bool(checks) and int(time.time() // 60) - int(checks[-1][0]) < minutes
