"""ESPN-shaped soccer responses for the tests (and the browser check).

Field names follow ESPN's public soccer API: scoreboard events, match
summaries (header, boxscore teams and form, rosters with per-player stats
and substitution plays, standings, head to head, pickcenter).
"""
from datetime import datetime, timedelta, timezone


def team(tid, abbr, name):
    return {"id": tid, "abbreviation": abbr, "displayName": name, "shortDisplayName": name.split()[0],
            "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png", "color": "ef0107", "alternateColor": "ffffff"}


ARS, CHE, LIV, TOT = team("359", "ARS", "Arsenal"), team("363", "CHE", "Chelsea"), team("364", "LIV", "Liverpool"), team("367", "TOT", "Tottenham Hotspur")


def scoreboard(event_id, home, away, when, home_ml=-150, draw_ml=280, away_ml=400):
    return {"leagues": [{"name": "English Premier League", "abbreviation": "EPL"}], "events": [{
        "id": event_id, "date": when, "competitions": [{
            "status": {"type": {"state": "pre", "completed": False}},
            "venue": {"fullName": "Emirates Stadium", "address": {"city": "London"}},
            "competitors": [{"homeAway": "home", "team": home, "records": [{"summary": "4-1-1"}]},
                            {"homeAway": "away", "team": away, "records": [{"summary": "3-2-1"}]}],
            "odds": [{"provider": {"name": "DraftKings"}, "homeTeamOdds": {"moneyLine": home_ml},
                      "awayTeamOdds": {"moneyLine": away_ml}, "drawOdds": {"moneyLine": draw_ml}}],
        }]}]}


def stat(name, value):
    return {"name": name, "value": value, "displayValue": str(value)}


def roster_entry(pid, name, pos, starter, stats, sub_in=None, sub_out=None, jersey="7"):
    plays = [{"substitution": True, "clock": {"displayValue": minute}} for minute in (sub_in, sub_out) if minute]
    return {"active": True, "starter": starter, "jersey": jersey, "athlete": {"id": pid, "displayName": name},
            "position": {"abbreviation": pos, "name": pos}, "subbedIn": bool(sub_in), "subbedOut": bool(sub_out),
            "plays": plays, "stats": [stat(key, value) for key, value in stats.items()]}


def summary(event_id, when, home, away, home_goals, away_goals, home_roster, away_roster, form=None, completed=True):
    def box(side_team, possession, shots, passes, tackles):
        return {"team": side_team, "statistics": [
            stat("possessionPct", possession), stat("totalShots", shots), stat("shotsOnTarget", shots // 3),
            stat("wonCorners", 5), stat("foulsCommitted", 11), stat("yellowCards", 2), stat("redCards", 0), stat("offsides", 1),
            stat("saves", 2), stat("totalPasses", passes), stat("accuratePasses", int(passes * .85)), stat("passPct", .85),
            stat("totalCrosses", 18), stat("totalTackles", tackles), stat("effectiveTackles", tackles - 4),
            stat("interceptions", 9), stat("totalClearance", 17), stat("effectiveClearance", 15)]}
    return {
        "header": {"id": event_id, "league": {"slug": "eng.1", "name": "English Premier League"}, "competitions": [{
            "id": event_id, "date": when,
            "status": {"type": {"completed": completed, "name": "STATUS_FULL_TIME" if completed else "STATUS_SCHEDULED", "shortDetail": "FT" if completed else "Sat 3:00 PM"}},
            "competitors": [{"homeAway": "home", "team": home, "score": str(home_goals), "winner": home_goals > away_goals},
                            {"homeAway": "away", "team": away, "score": str(away_goals), "winner": away_goals > home_goals}]}]},
        "boxscore": {"teams": [box(home, 58.2, 16, 560, 17), box(away, 41.8, 9, 402, 21)], "form": form or []},
        "rosters": [{"homeAway": "home", "team": home, "formation": "4-3-3", "roster": home_roster},
                    {"homeAway": "away", "team": away, "formation": "4-2-3-1", "roster": away_roster}],
        "gameInfo": {"venue": {"fullName": "Emirates Stadium", "address": {"city": "London"}}},
    }


def arsenal_roster(shots, sot, goals=0, saka_starts=True):
    return [
        roster_entry("1", "David Raya", "G", True, {"saves": 3, "goalsConceded": 1, "shotsFaced": 4, "appearances": 1}, jersey="22"),
        roster_entry("2", "Bukayo Saka", "F", saka_starts, {"totalShots": shots, "shotsOnTarget": sot, "totalGoals": goals, "goalAssists": 1,
                                                            "foulsSuffered": 3, "foulsCommitted": 1, "appearances": 1},
                     sub_out="78'" if saka_starts else None, sub_in=None if saka_starts else "60'"),
        roster_entry("3", "Leandro Trossard", "F", False, {"totalShots": 1, "appearances": 1}, sub_in="78'", jersey="19"),
        roster_entry("4", "Unused Sub", "D", False, {"appearances": 0}, jersey="31"),
    ]


def opponent_roster(saves):
    return [roster_entry("50", "Robert Sanchez", "G", True, {"saves": saves, "goalsConceded": 2, "shotsFaced": saves + 2, "appearances": 1}, jersey="1"),
            roster_entry("51", "Cole Palmer", "M", True, {"totalShots": 4, "shotsOnTarget": 2, "appearances": 1}, jersey="20")]


def dated(days_ago, now=None):
    now = now or datetime(2026, 9, 28, 12, tzinfo=timezone.utc)
    return (now - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%MZ")
