from __future__ import annotations

import csv
import io
import time
from dataclasses import asdict, fields as dataclass_fields, is_dataclass
from enum import Enum
from types import UnionType
from typing import Union, get_args, get_origin, get_type_hints
from datetime import datetime, time as dt_time, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..cache import NFLCacheDomain, cached_nfl
from ..domain import (
    DataStatus, NFLDepthChartEntry, NFLGame, NFLGameLog, NFLInjury, NFLPlayer,
    NFLPosition, NFLTeam, NFLTeamGameStats, NFLTeamRef,
)
from .base import ProviderResult
from .research_stats import prizepicks_fantasy

SOURCE = "nflverse"
SOURCE_VERSION = "nflverse-data-v3"
TEAM_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/teams.csv"
SCHEDULE_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
RELEASE = "https://github.com/nflverse/nflverse-data/releases/download"

TEAM_ALIASES = {
    "JAC": "JAX", "LA": "LAR", "STL": "LAR", "SD": "LAC", "OAK": "LV",
    "WSH": "WAS", "ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU",
}
VALID_POSITIONS = {position.value for position in NFLPosition}
VALID_GAME_TYPES = {"PRE", "REG", "WC", "DIV", "CON", "SB"}


class ProviderError(RuntimeError):
    pass


class ProviderRateLimited(ProviderError):
    pass


def canonical_team(value: str | None) -> str:
    team = str(value or "").strip().upper()
    return TEAM_ALIASES.get(team, team)


def _integer(row: dict, key: str, *, required: bool = False) -> int | None:
    raw = row.get(key)
    if raw in (None, "", "NA", "N/A"):
        if required:
            raise ValueError(f"missing {key}")
        return None
    value = int(float(raw))
    if value < 0:
        raise ValueError(f"negative {key}")
    return value


def _number(row: dict, key: str) -> float | None:
    raw = row.get(key)
    if raw in (None, "", "NA", "N/A"):
        return None
    return float(raw)


def _date(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _eastern_offset(day) -> timezone:
    """US Eastern offset without an optional system/IANA tzdata dependency."""
    march = datetime(day.year, 3, 8)
    dst_start = (march + timedelta(days=(6 - march.weekday()) % 7)).date()
    november = datetime(day.year, 11, 1)
    dst_end = (november + timedelta(days=(6 - november.weekday()) % 7)).date()
    return timezone(timedelta(hours=-4 if dst_start <= day < dst_end else -5))


def _fetch_csv(url: str, attempts: int = 3) -> tuple[list[dict], datetime, datetime | None]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(url, headers={"Accept": "text/csv", "User-Agent": "Krazy-Data-NFL/1.0"})
            with urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8-sig")
                modified = response.headers.get("Last-Modified")
            rows = list(csv.DictReader(io.StringIO(body)))
            if not rows:
                raise ProviderError("provider returned no CSV records")
            observed = parsedate_to_datetime(modified) if modified else None
            return rows, datetime.now(timezone.utc), observed
        except HTTPError as exc:
            if exc.code == 429:
                raise ProviderRateLimited("nflverse rate limit reached") from exc
            if 400 <= exc.code < 500:
                raise ProviderError(f"nflverse returned HTTP {exc.code}") from exc
            last_error = exc
        except (URLError, TimeoutError, UnicodeDecodeError, csv.Error, ProviderError) as exc:
            last_error = exc
        if attempt + 1 < attempts:
            time.sleep(0.2 * (2 ** attempt))
    raise ProviderError(f"nflverse request failed: {last_error}")


def _result(loader: Callable[[], tuple[list, datetime, datetime | None]]) -> ProviderResult[list]:
    try:
        data, fetched, observed = loader()
        return ProviderResult(DataStatus.AVAILABLE, data, SOURCE, fetched, observed)
    except ProviderRateLimited as exc:
        return ProviderResult(DataStatus.UNRELIABLE, None, SOURCE, datetime.now(timezone.utc), reason=str(exc))
    except (ProviderError, ValueError, TypeError, OverflowError) as exc:
        return ProviderResult(DataStatus.MISSING, None, SOURCE, datetime.now(timezone.utc), reason=str(exc))


# Every loader below returns (rows, fetched, observed) where rows are frozen
# dataclasses and the timestamps are datetimes -- a shape json.dumps refuses,
# which meant cache._kv_set silently dropped ALL of it and the durable cache
# was dead for the whole provider. api/nfl.py caches finished payloads for the
# resources it serves, but nothing internal goes through there: the props
# board looks up game_logs per player for every game on the slate, and
# opportunity/matchup/projection all call straight into this module. This
# codec is what lets those share one cache instead of each cold instance
# re-downloading a season CSV.
def _jsonable(value):
    # asdict() rebuilds nested dataclasses but leaves datetimes (and any
    # other non-JSON scalar) exactly as they were, so the encoded row was
    # still unserialisable. StrEnum members already dump as their string.
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


def _coerce(hint, raw):
    if raw is None:
        return None
    origin = get_origin(hint)
    if origin in (Union, UnionType):
        options = [arg for arg in get_args(hint) if arg is not type(None)]
        # Optional[X] revives as X; a genuine multi-type union (int | float)
        # is already exactly what JSON gave back.
        return _coerce(options[0], raw) if len(options) == 1 else raw
    if origin is not None:
        return raw  # dict[...]/list[...] round-trip as themselves
    if is_dataclass(hint):
        return _revive(hint, raw)
    if isinstance(hint, type) and issubclass(hint, Enum):
        return hint(raw)
    if hint is datetime:
        return datetime.fromisoformat(raw)
    return raw


def _revive(cls, data):
    hints = get_type_hints(cls)
    return cls(**{f.name: _coerce(hints[f.name], data.get(f.name)) for f in dataclass_fields(cls)})


def _provider_codec(row_class):
    """(encode, decode) for this module's (rows, fetched, observed) tuples.
    `row_class` is None where the rows are already plain dicts."""
    def encode(value):
        rows, fetched, observed = value
        return {'rows': [_jsonable(asdict(row) if is_dataclass(row) else row) for row in rows],
                'fetched': fetched.isoformat(),
                'observed': observed.isoformat() if observed else None}

    def decode(raw):
        rows = [_revive(row_class, row) for row in raw['rows']] if row_class else list(raw['rows'])
        return (rows, datetime.fromisoformat(raw['fetched']),
                datetime.fromisoformat(raw['observed']) if raw['observed'] else None)

    return encode, decode


def _source_rows(url: str):
    # Every caller below (teams, schedule, game_logs, usage, injuries,
    # depth_chart, team_stats) fetches from a season-wide static CSV, but
    # each one is keyed by its OWN cache domain downstream -- game_logs in
    # particular caches by (season, player_id), so looking up N different
    # players for the same season previously re-downloaded and re-parsed
    # this exact same file N times over the network, sequentially, once per
    # player. Caching the raw rows here by URL means every caller shares
    # one fetch+parse per file instead of paying for it again per player.
    # Memory-only: one season's player-stats CSV is ~68MB as JSON, far past
    # anything worth putting in a shared store. The per-result caches below
    # are what make a cold instance cheap; this just stops the callers in a
    # single request re-parsing the same file.
    return cached_nfl(NFLCacheDomain.SOURCE_ROWS, (url,), lambda: _fetch_csv(url), durable=False)


def teams(season: int) -> ProviderResult[list[NFLTeam]]:
    def load():
        rows, fetched, observed = _source_rows(TEAM_URL)
        by_team = {}
        for row in rows:
            if _integer(row, "season") != season:
                continue
            abbr = canonical_team(row.get("team"))
            if not abbr or not row.get("full"):
                continue
            team = NFLTeam(
                id=abbr, abbreviation=abbr, name=row["full"], city=row.get("location") or "",
                nickname=row.get("nickname") or "", source_ids={
                    key: str(row[key]) for key in ("nfl_team_id", "nfl", "espn", "pfr", "pff") if row.get(key)
                },
            )
            by_team[abbr] = team
        if len(by_team) < 32:
            raise ProviderError(f"team validation retained only {len(by_team)} records")
        return sorted(by_team.values(), key=lambda team: team.abbreviation), fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.TEAMS, (SOURCE_VERSION, season), load, codec=_provider_codec(NFLTeam)))


def players(season: int) -> ProviderResult[list[NFLPlayer]]:
    url = f"{RELEASE}/rosters/roster_{season}.csv"
    def load():
        rows, fetched, observed = _source_rows(url)
        output, seen = [], set()
        for row in rows:
            player_id = str(row.get("gsis_id") or "").strip()
            position = str(row.get("position") or "").strip().upper()
            team_id = canonical_team(row.get("team"))
            if not player_id or position not in VALID_POSITIONS or not team_id or player_id in seen:
                continue
            seen.add(player_id)
            source_ids = {key: str(row[key]) for key in (
                "gsis_id", "espn_id", "sportradar_id", "yahoo_id", "rotowire_id", "pff_id", "pfr_id", "sleeper_id"
            ) if row.get(key) and row.get(key) not in {"NA", "0"}}
            espn_id = source_ids.get("espn_id")
            verified_headshot = (f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png" if espn_id else None) or row.get("headshot_url")
            output.append(NFLPlayer(
                id=player_id, name=row.get("full_name") or row.get("football_name") or "",
                position=NFLPosition(position), team_id=team_id,
                first_name=row.get("first_name") or "", last_name=row.get("last_name") or "",
                status=row.get("status") or "UNKNOWN", jersey_number=row.get("jersey_number") or None,
                headshot_url=verified_headshot, source_ids=source_ids,
            ))
        if not output:
            raise ProviderError("no valid offensive skill players")
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.PLAYERS, (SOURCE_VERSION, season), load, codec=_provider_codec(NFLPlayer)))


def roster_headshots(season: int) -> dict[str, str]:
    """Verified GSIS -> headshot mapping for every roster position.

    The public player search intentionally keeps only fantasy positions, but
    depth charts and injury reports also contain OL/DL/DB/LB players. Joining
    the complete roster here prevents those context cards from losing photos.
    """
    url = f"{RELEASE}/rosters/roster_{season}.csv"
    rows, _, _ = _source_rows(url)
    output = {}
    for row in rows:
        player_id = str(row.get("gsis_id") or "").strip()
        espn_id = str(row.get("espn_id") or "").strip()
        headshot = (f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png" if espn_id not in ("", "NA", "0") else None) or row.get("headshot_url")
        if player_id and headshot:
            output[player_id] = headshot
    return output


def schedule(season: int, week: int | None = None, season_type: str | None = None) -> ProviderResult[list[NFLGame]]:
    def load():
        rows, fetched, observed = _source_rows(SCHEDULE_URL)
        output, seen = [], set()
        for row in rows:
            if _integer(row, "season") != season:
                continue
            game_type = str(row.get("game_type") or "").upper()
            row_week = _integer(row, "week")
            if game_type not in VALID_GAME_TYPES or row_week is None:
                continue
            if week is not None and row_week != week:
                continue
            if season_type and game_type != season_type.upper():
                continue
            game_id = str(row.get("game_id") or "")
            home, away = canonical_team(row.get("home_team")), canonical_team(row.get("away_team"))
            if not game_id or not home or not away or home == away or game_id in seen:
                continue
            played = row.get("gameday")
            clock = row.get("gametime") or "00:00"
            try:
                local = datetime.combine(datetime.strptime(played, "%Y-%m-%d").date(), dt_time.fromisoformat(clock))
                starts_at = local.replace(tzinfo=_eastern_offset(local.date())).astimezone(timezone.utc)
            except (TypeError, ValueError):
                continue
            seen.add(game_id)
            final = row.get("home_score") not in (None, "") and row.get("away_score") not in (None, "")
            status = "FINAL" if final else "SCHEDULED"
            output.append(NFLGame(
                id=game_id, season=season, season_type=game_type, week=row_week,
                starts_at=starts_at, status=status,
                home_team=NFLTeamRef(home, home, home), away_team=NFLTeamRef(away, away, away),
                venue=row.get("stadium") or None, roof=row.get("roof") or None,
                temperature_f=_number(row, "temp"), wind_mph=_number(row, "wind"),
                precipitation_probability=None,
                source_ids={key: str(row[key]) for key in ("old_game_id", "gsis", "nfl_detail_id", "pfr", "pff", "espn") if row.get(key)},
            ))
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.SCHEDULE, (SOURCE_VERSION, season, week or "all", season_type or "all"), load, codec=_provider_codec(NFLGame)))


PLAYER_STAT_FIELDS = (
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "carries", "rushing_yards", "rushing_tds", "targets", "receptions", "receiving_yards",
    "receiving_tds", "target_share", "air_yards_share", "fantasy_points", "fantasy_points_ppr",
)
NONNEGATIVE_PLAYER_FIELDS = {
    "completions", "attempts", "passing_tds", "passing_interceptions", "carries", "rushing_tds",
    "targets", "receptions", "receiving_tds", "target_share", "air_yards_share",
}


def game_logs(season: int, player_id: str, season_type: str = "REG") -> ProviderResult[list[NFLGameLog]]:
    url = f"{RELEASE}/stats_player/stats_player_week_{season}.csv"
    def load():
        rows, fetched, observed = _source_rows(url)
        output, seen = [], set()
        for row in rows:
            if row.get("player_id") != player_id or str(row.get("season_type") or "").upper() != season_type.upper():
                continue
            position = str(row.get("position") or "").upper()
            game_id = str(row.get("game_id") or "")
            if position not in VALID_POSITIONS or not game_id or game_id in seen:
                continue
            stats = {}
            for field in PLAYER_STAT_FIELDS:
                value = _number(row, field)
                stats[field] = int(value) if value is not None and value.is_integer() else value
            if any(stats[key] is not None and stats[key] < 0 for key in NONNEGATIVE_PLAYER_FIELDS):
                continue
            if stats["completions"] is not None and stats["attempts"] is not None and stats["completions"] > stats["attempts"]:
                continue
            stats['prizepicks_fantasy_score'] = prizepicks_fantasy(row)
            seen.add(game_id)
            team, opponent = canonical_team(row.get("team")), canonical_team(row.get("opponent_team"))
            game_parts = game_id.split("_")
            is_home = team == canonical_team(game_parts[-1]) if len(game_parts) >= 4 else None
            output.append(NFLGameLog(
                player_id=player_id, player_name=row.get("player_display_name") or row.get("player_name") or "",
                position=NFLPosition(position), game_id=game_id, season=season,
                season_type=season_type.upper(), week=_integer(row, "week", required=True),
                team_id=team, opponent_team_id=opponent, is_home=is_home, stats=stats, source=SOURCE,
            ))
        output.sort(key=lambda item: item.week)
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.GAME_LOGS, (SOURCE_VERSION, 'research-stats-v2', season, season_type, player_id), load, codec=_provider_codec(NFLGameLog)))


TEAM_STAT_FIELDS = ("attempts", "passing_yards", "carries", "rushing_yards", "def_sacks", "def_interceptions", "sacks_suffered", "targets")


def team_game_stats(season: int, team_id: str, season_type: str = "REG") -> ProviderResult[list[NFLTeamGameStats]]:
    url = f"{RELEASE}/stats_team/stats_team_week_{season}.csv"
    team_id = canonical_team(team_id)
    def load():
        rows, fetched, observed = _source_rows(url)
        schedule_rows, _, _ = _source_rows(SCHEDULE_URL)
        scores = {}
        for game in schedule_rows:
            if _integer(game, "season") != season:
                continue
            game_id = str(game.get("game_id") or "")
            home, away = canonical_team(game.get("home_team")), canonical_team(game.get("away_team"))
            scores[(game_id, home)] = _number(game, "home_score")
            scores[(game_id, away)] = _number(game, "away_score")
        output = []
        for row in rows:
            if canonical_team(row.get("team")) != team_id or str(row.get("season_type") or "").upper() != season_type.upper():
                continue
            stats = {field: _number(row, field) for field in TEAM_STAT_FIELDS}
            attempts, carries = stats.get("attempts"), stats.get("carries")
            sacks = stats.get("sacks_suffered")
            stats["offensive_plays"] = attempts + carries + sacks if all(value is not None for value in (attempts, carries, sacks)) else None
            stats["pass_plays"] = attempts + sacks if attempts is not None and sacks is not None else None
            stats["points"] = scores.get((str(row.get("game_id") or ""), team_id))
            stats["drives"] = None
            output.append(NFLTeamGameStats(
                game_id=str(row.get("game_id") or ""), season=season, season_type=season_type.upper(),
                week=_integer(row, "week", required=True), team_id=team_id,
                opponent_team_id=canonical_team(row.get("opponent_team")), stats=stats, source=SOURCE,
            ))
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.STATS, (SOURCE_VERSION, season, season_type, team_id), load, codec=_provider_codec(NFLTeamGameStats)))


def defense_game_stats(season: int, team_id: str, season_type: str = "REG") -> ProviderResult[list[NFLTeamGameStats]]:
    """Normalize defense faced from opponent offense plus credited sacks/INTs."""
    url = f"{RELEASE}/stats_team/stats_team_week_{season}.csv"
    team_id = canonical_team(team_id)
    def load():
        rows, fetched, observed = _source_rows(url)
        schedule_rows, _, _ = _source_rows(SCHEDULE_URL)
        allowed_points = {}
        for game in schedule_rows:
            if _integer(game, "season") != season:
                continue
            game_id = str(game.get("game_id") or "")
            home, away = canonical_team(game.get("home_team")), canonical_team(game.get("away_team"))
            allowed_points[(game_id, home)] = _number(game, "away_score")
            allowed_points[(game_id, away)] = _number(game, "home_score")
        own = {str(row.get("game_id")): row for row in rows
               if canonical_team(row.get("team")) == team_id and str(row.get("season_type") or "").upper() == season_type.upper()}
        output = []
        for row in rows:
            if canonical_team(row.get("opponent_team")) != team_id or str(row.get("season_type") or "").upper() != season_type.upper():
                continue
            game_id = str(row.get("game_id") or "")
            defense_row = own.get(game_id, {})
            stats = {
                "passing_yards_allowed": _number(row, "passing_yards"),
                "rushing_yards_allowed": _number(row, "rushing_yards"),
                "pass_attempts_faced": _number(row, "attempts"),
                "rush_attempts_faced": _number(row, "carries"),
                "sacks": _number(defense_row, "def_sacks"),
                "interceptions": _number(defense_row, "def_interceptions"),
                "points_allowed": allowed_points.get((game_id, team_id)),
            }
            output.append(NFLTeamGameStats(
                game_id=game_id, season=season, season_type=season_type.upper(),
                week=_integer(row, "week", required=True), team_id=team_id,
                opponent_team_id=canonical_team(row.get("team")), stats=stats, source=SOURCE,
            ))
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.DEFENSE, (SOURCE_VERSION, season, season_type, team_id), load, codec=_provider_codec(NFLTeamGameStats)))


def injuries(season: int, week: int | None = None) -> ProviderResult[list[NFLInjury]]:
    url = f"{RELEASE}/injuries/injuries_{season}.csv"
    def load():
        rows, fetched, observed = _source_rows(url)
        output, seen = [], set()
        for row in rows:
            row_week = _integer(row, "week")
            if week is not None and row_week != week:
                continue
            player_id = str(row.get("gsis_id") or "").strip()
            if not player_id or row_week is None:
                continue
            key = (player_id, row_week, row.get("report_status"), row.get("practice_status"))
            if key in seen:
                continue
            seen.add(key)
            output.append(NFLInjury(
                player_id=player_id, player_name=row.get("full_name") or "",
                team_id=canonical_team(row.get("team")), position=row.get("position") or "",
                season=season, season_type=(row.get("season_type") or row.get("game_type") or "REG").upper(),
                week=row_week, injury=row.get("report_primary_injury") or row.get("practice_primary_injury") or None,
                game_status=row.get("report_status") or None, practice_status=row.get("practice_status") or None,
                report_date=None, source=SOURCE,
            ))
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.INJURIES, (SOURCE_VERSION, season, week or "all"), load, codec=_provider_codec(NFLInjury)))


def depth_chart(season: int, team_id: str | None = None, *, latest_only: bool = True) -> ProviderResult[list[NFLDepthChartEntry]]:
    url = f"{RELEASE}/depth_charts/depth_charts_{season}.csv"
    normalized_team = canonical_team(team_id) if team_id else None
    def load():
        rows, fetched, observed = _source_rows(url)
        output, seen = [], set()
        for row in rows:
            team = canonical_team(row.get("team") or row.get("club_code"))
            if normalized_team and team != normalized_team:
                continue
            player_id = str(row.get("gsis_id") or "").strip()
            updated = _date(row.get("dt"))
            rank = _integer(row, "pos_rank") or _integer(row, "depth_team")
            if not team or not player_id or not updated or rank is None:
                continue
            key = (team, player_id, row.get("pos_abb") or row.get("position"), updated)
            if key in seen:
                continue
            seen.add(key)
            output.append(NFLDepthChartEntry(
                team_id=team, player_id=player_id, player_name=row.get("player_name") or row.get("full_name") or "",
                position=row.get("pos_abb") or row.get("position") or "",
                role=row.get("pos_name") or row.get("depth_position") or "",
                rank=rank, updated_at=updated, source=SOURCE,
            ))
        if output and latest_only:
            latest = max(entry.updated_at for entry in output)
            output = [entry for entry in output if entry.updated_at == latest]
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.DEPTH_CHARTS, (SOURCE_VERSION, season, normalized_team or "all", "latest" if latest_only else "history"), load, codec=_provider_codec(NFLDepthChartEntry)))


def snap_counts(season: int, pfr_player_id: str | None = None) -> ProviderResult[list[dict]]:
    url = f"{RELEASE}/snap_counts/snap_counts_{season}.csv"
    def load():
        rows, fetched, observed = _source_rows(url)
        output = []
        for row in rows:
            # Snap files use PFR IDs rather than GSIS IDs. Do not pretend this is
            # a stable join when no verified crosswalk is present.
            if pfr_player_id and row.get("pfr_player_id") != pfr_player_id:
                continue
            if not row.get("game_id") or not row.get("pfr_player_id"):
                continue
            output.append({
                "game_id": row["game_id"], "season": _integer(row, "season", required=True),
                "season_type": row.get("game_type"), "week": _integer(row, "week", required=True),
                "player_name": row.get("player"), "pfr_player_id": row.get("pfr_player_id"),
                "position": row.get("position"), "team_id": canonical_team(row.get("team")),
                "opponent_team_id": canonical_team(row.get("opponent")),
                "offense_snaps": _integer(row, "offense_snaps"), "offense_snap_rate": _number(row, "offense_pct"),
                "source": SOURCE,
            })
        return output, fetched, observed
    return _result(lambda: cached_nfl(NFLCacheDomain.USAGE, (SOURCE_VERSION, season, pfr_player_id or "all"), load, codec=_provider_codec(None)))


def serialize_result(result: ProviderResult[list]) -> dict:
    return {
        "status": result.status.value,
        "data": [asdict(item) if hasattr(item, "__dataclass_fields__") else item for item in (result.data or [])],
        "source": result.source,
        "sourceVersion": SOURCE_VERSION,
        "fetchedAt": result.fetched_at.isoformat(),
        "observedAt": result.observed_at.isoformat() if result.observed_at else None,
        "reason": result.reason,
    }


class NFLVerseProvider:
    """Concrete provider facade over the validated nflverse adapters."""

    name = SOURCE

    def players(self, *, season: int):
        return players(season)

    def teams(self, *, season: int):
        return teams(season)

    def games(self, *, season: int, week: int):
        return schedule(season, week)

    def props(self, *, game_id: str):
        return ProviderResult(
            DataStatus.NOT_AVAILABLE, None, SOURCE, datetime.now(timezone.utc),
            reason="No authorized NFL prop-line provider is configured.",
        )

    def player_stats(self, *, player_id: str, season: int):
        return game_logs(season, player_id)

    def game_logs(self, *, player_id: str, season: int):
        return game_logs(season, player_id)

    def player_usage(self, *, player_id: str, season: int):
        roster = players(season)
        if roster.data is None:
            return roster
        player = next((row for row in roster.data if row.id == player_id), None)
        pfr_id = player.source_ids.get("pfr_id") if player else None
        if not pfr_id:
            return ProviderResult(
                DataStatus.MISSING, None, SOURCE, datetime.now(timezone.utc),
                reason="No verified GSIS-to-PFR identity mapping exists for this player.",
            )
        return snap_counts(season, pfr_id)

    def team_usage(self, *, team_id: str, season: int):
        return team_game_stats(season, team_id)

    def injuries(self, *, team_id: str, season: int, week: int | None = None):
        result = injuries(season, week)
        if result.data is None:
            return result
        team = canonical_team(team_id)
        return ProviderResult(result.status, [row for row in result.data if row.team_id == team], result.source,
                              result.fetched_at, result.observed_at, result.reason)

    def depth_chart(self, *, team_id: str, season: int):
        return depth_chart(season, team_id)

    def defense(self, *, team_id: str, season: int):
        return defense_game_stats(season, team_id)

    def weather(self, *, game_id: str):
        return ProviderResult(
            DataStatus.NOT_AVAILABLE, None, SOURCE, datetime.now(timezone.utc),
            reason="No authorized live NFL forecast provider is configured.",
        )


provider = NFLVerseProvider()
