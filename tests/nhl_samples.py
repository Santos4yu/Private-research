"""Samples in the NHL's own shapes (the stats service's per-game rows, the
game feed's box score, schedule and roster; PrizePicks rows) for the NHL
tests."""

CAR_ID, FLA_ID = 12, 13
STAAL, AHO, SLAVIN, ANDERSEN = 8473533, 8478427, 8476958, 8475883
BARKOV, EKBLAD, BOBROVSKY = 8477493, 8477932, 8475683


def skater(pid, name, position, **stats):
    base = {"playerId": pid, "sweaterNumber": 11, "name": {"default": name}, "position": position, "goals": 0,
            "assists": 0, "points": 0, "plusMinus": 0, "pim": 0, "hits": 0, "powerPlayGoals": 0, "sog": 0,
            "faceoffWinningPctg": 0.0, "toi": "15:00", "blockedShots": 0, "shifts": 20, "giveaways": 0, "takeaways": 0}
    base.update(stats)
    return base


def goalie(pid, name, **stats):
    base = {"playerId": pid, "sweaterNumber": 31, "name": {"default": name}, "position": "G",
            "saveShotsAgainst": "0/0", "goalsAgainst": 0, "toi": "60:00", "starter": True, "decision": ""}
    base.update(stats)
    return base


def box(game_id="2026010030", game_type=1, day="2026-09-22", home_score=3, away_score=2, state="OFF"):
    """CAR (home) 3, FLA 2 in preseason."""
    return {
        "id": int(game_id), "season": 20262027, "gameType": game_type, "gameDate": day, "gameState": state,
        "startTimeUTC": f"{day}T23:00:00Z", "gameOutcome": {"lastPeriodType": "REG"},
        "homeTeam": {"id": CAR_ID, "abbrev": "CAR", "score": home_score, "sog": 30},
        "awayTeam": {"id": FLA_ID, "abbrev": "FLA", "score": away_score, "sog": 25},
        "playerByGameStats": {
            "homeTeam": {
                "forwards": [skater(STAAL, "J. Staal", "C", goals=1, points=1, sog=3, hits=4, blockedShots=1, powerPlayGoals=1, toi="17:23"),
                             skater(AHO, "S. Aho", "C", goals=1, assists=1, points=2, sog=2, toi="19:10")],
                "defense": [skater(SLAVIN, "J. Slavin", "D", goals=1, points=1, sog=1, blockedShots=3, hits=1, toi="22:30")],
                "goalies": [goalie(ANDERSEN, "F. Andersen", saveShotsAgainst="23/25", goalsAgainst=2, decision="W")],
            },
            "awayTeam": {
                "forwards": [skater(BARKOV, "A. Barkov", "C", goals=2, points=2, sog=4, toi="20:00")],
                "defense": [skater(EKBLAD, "A. Ekblad", "D", assists=1, points=1, hits=2, toi="21:00")],
                "goalies": [goalie(BOBROVSKY, "S. Bobrovsky", saveShotsAgainst="27/29", goalsAgainst=2, decision="L"),
                            goalie(8480000, "S. Knight", saveShotsAgainst="0/0", goalsAgainst=0, toi="00:00", starter=False)],
            },
        },
    }


# ---------------------------------------------------------------- stats service rows

def team_row(game_id, team, opponent, home, day, goals_for, goals_against, shots_for=30, shots_against=28, **result):
    """A team/summary game row. The stats service leaves the shootout goal
    out of goalsFor / goalsAgainst."""
    row = {"gameId": int(game_id), "gameDate": day, "teamId": 1, "teamFullName": TEAM_NAMES[team], "opponentTeamAbbrev": opponent,
           "homeRoad": "H" if home else "R", "goalsFor": goals_for, "goalsAgainst": goals_against,
           "shotsForPerGame": shots_for, "shotsAgainstPerGame": shots_against, "wins": 0, "losses": 0, "otLosses": 0,
           "winsInRegulation": 0, "winsInShootout": 0, "regulationAndOtWins": 0, "gamesPlayed": 1}
    row.update(result)
    return row


TEAM_NAMES = {"CAR": "Carolina Hurricanes", "FLA": "Florida Panthers", "NJD": "New Jersey Devils"}


def summary_row(game_id, pid, name, team, opponent, position, day, home=True, toi=900, **stats):
    row = {"gameId": int(game_id), "playerId": pid, "skaterFullName": name, "teamAbbrev": team, "opponentTeamAbbrev": opponent,
           "positionCode": position, "gameDate": day, "homeRoad": "H" if home else "R", "shootsCatches": "L",
           "goals": 0, "assists": 0, "points": 0, "shots": 0, "penaltyMinutes": 0, "plusMinus": 0, "ppGoals": 0,
           "ppPoints": 0, "shPoints": 0, "timeOnIcePerGame": toi, "gamesPlayed": 1}
    row.update(stats)
    return row


def realtime_row(game_id, pid, hits=0, blocked=0, attempts=0):
    return {"gameId": int(game_id), "playerId": pid, "hits": hits, "blockedShots": blocked, "totalShotAttempts": attempts}


def faceoff_row(game_id, pid, won, lost):
    return {"gameId": int(game_id), "playerId": pid, "totalFaceoffWins": won, "totalFaceoffLosses": lost, "totalFaceoffs": won + lost}


def goalie_row(game_id, pid, name, team, opponent, day, saves, against, toi=3600, **stats):
    row = {"gameId": int(game_id), "playerId": pid, "goalieFullName": name, "teamAbbrev": team, "opponentTeamAbbrev": opponent,
           "gameDate": day, "saves": saves, "shotsAgainst": against, "goalsAgainst": against - saves, "timeOnIce": toi,
           "wins": 0, "losses": 0, "otLosses": 0, "shutouts": 0, "gamesStarted": 1, "shootsCatches": "L"}
    row.update(stats)
    return row


# CAR beat FLA 4-3 in a shootout on Jan 10 (at home) and lost 2-1 in overtime
# at FLA on Feb 1; both are 2025-26 regular season games.
SO_GAME, OT_GAME = "2025020500", "2025020600"


def season_rows():
    """{report: rows} for both teams' two games."""
    return {
        "team/summary": [
            team_row(SO_GAME, "CAR", "FLA", True, "2026-01-10", 3, 3, 35, 30, wins=1, winsInShootout=1),
            team_row(SO_GAME, "FLA", "CAR", False, "2026-01-10", 3, 3, 30, 35, otLosses=1),
            team_row(OT_GAME, "CAR", "FLA", False, "2026-02-01", 1, 2, 25, 33, otLosses=1),
            team_row(OT_GAME, "FLA", "CAR", True, "2026-02-01", 2, 1, 33, 25, wins=1, regulationAndOtWins=1),
        ],
        "skater/summary": [
            summary_row(SO_GAME, STAAL, "Jordan Staal", "CAR", "FLA", "C", "2026-01-10", goals=3, points=3, shots=5, ppGoals=1,
                        ppPoints=1, toi=1043),
            summary_row(SO_GAME, AHO, "Sebastian Aho", "CAR", "FLA", "C", "2026-01-10", assists=2, points=2, shots=2,
                        shPoints=1, toi=1150),
            summary_row(SO_GAME, SLAVIN, "Jaccob Slavin", "CAR", "FLA", "D", "2026-01-10", shots=1, toi=1350),
            summary_row(SO_GAME, BARKOV, "Aleksander Barkov", "FLA", "CAR", "C", "2026-01-10", home=False, goals=2, points=2, shots=4),
            summary_row(SO_GAME, EKBLAD, "Aaron Ekblad", "FLA", "CAR", "D", "2026-01-10", home=False, goals=1, points=1, shots=1),
            summary_row(OT_GAME, STAAL, "Jordan Staal", "CAR", "FLA", "C", "2026-02-01", home=False, goals=1, points=1, shots=3, toi=1000),
            summary_row(OT_GAME, AHO, "Sebastian Aho", "CAR", "FLA", "C", "2026-02-01", home=False, shots=4, toi=1200),
            summary_row(OT_GAME, BARKOV, "Aleksander Barkov", "FLA", "CAR", "C", "2026-02-01", goals=1, assists=1, points=2, shots=5),
            summary_row(OT_GAME, EKBLAD, "Aaron Ekblad", "FLA", "CAR", "D", "2026-02-01", assists=1, points=1, shots=2),
        ],
        "skater/realtime": [
            realtime_row(SO_GAME, STAAL, hits=4, blocked=1, attempts=9), realtime_row(SO_GAME, AHO, hits=1, attempts=4),
            realtime_row(SO_GAME, SLAVIN, hits=1, blocked=3, attempts=2), realtime_row(SO_GAME, BARKOV, hits=2, attempts=7),
            realtime_row(SO_GAME, EKBLAD, hits=3, blocked=2, attempts=3), realtime_row(OT_GAME, STAAL, hits=2, attempts=5),
            realtime_row(OT_GAME, AHO, blocked=1, attempts=6), realtime_row(OT_GAME, BARKOV, hits=1, attempts=8),
            realtime_row(OT_GAME, EKBLAD, blocked=4, attempts=3),
        ],
        # Defensemen who took no faceoffs have no row here.
        "skater/faceoffwins": [
            faceoff_row(SO_GAME, STAAL, 12, 8), faceoff_row(SO_GAME, AHO, 6, 9), faceoff_row(SO_GAME, BARKOV, 14, 10),
            faceoff_row(OT_GAME, STAAL, 10, 10), faceoff_row(OT_GAME, AHO, 7, 7), faceoff_row(OT_GAME, BARKOV, 15, 9),
        ],
        "goalie/summary": [
            goalie_row(SO_GAME, ANDERSEN, "Frederik Andersen", "CAR", "FLA", "2026-01-10", 27, 30, toi=3900, wins=1),
            goalie_row(SO_GAME, BOBROVSKY, "Sergei Bobrovsky", "FLA", "CAR", "2026-01-10", 32, 35, toi=3900, otLosses=1),
            goalie_row(OT_GAME, ANDERSEN, "Frederik Andersen", "CAR", "FLA", "2026-02-01", 31, 33, toi=3780, otLosses=1),
            goalie_row(OT_GAME, BOBROVSKY, "Sergei Bobrovsky", "FLA", "CAR", "2026-02-01", 24, 25, toi=3780, wins=1),
            # FLA's backup dressed but never went in.
            goalie_row(OT_GAME, 8480000, "Spencer Knight", "FLA", "CAR", "2026-02-01", 0, 0, toi=0, gamesStarted=0),
        ],
    }


def _with_teams(rows):
    """The real-time and faceoff rows carry the player's club too."""
    teams = {(row["gameId"], row["playerId"]): row["teamAbbrev"] for row in rows["skater/summary"]}
    for report in ("skater/realtime", "skater/faceoffwins"):
        for row in rows.get(report, []):
            row.setdefault("teamAbbrev", teams[(row["gameId"], row["playerId"])])
    return rows


def fake_stats(rows=None):
    """_stats() over season_rows(): a team filter (teamAbbrev="X") keeps
    that team's rows; a team/summary row's club is its full name."""
    rows = _with_teams(rows or season_rows())
    calls = []

    def run(report, cayenne, game=True):
        calls.append((report, cayenne, game))
        found = rows.get(report, [])
        if 'teamAbbrev="' in cayenne:
            team = cayenne.split('teamAbbrev="')[1].split('"')[0]
            found = [row for row in found if row.get("teamAbbrev", {v: k for k, v in TEAM_NAMES.items()}.get(row.get("teamFullName"))) == team]
        if "seasonId=" in cayenne:
            season = cayenne.split("seasonId=")[1][:4]
            found = [row for row in found if str(row["gameId"]).startswith(season)]
        return [dict(row) for row in found]
    run.calls = calls
    return run


def schedule_games(*games):
    """Games on the game feed's weekly schedule: (id, type, date, state),
    CAR at home to FLA."""
    return [{"id": int(game_id), "gameType": kind, "date": day, "startTimeUTC": f"{day}T23:00:00Z", "gameState": state,
             "homeTeam": {"abbrev": "CAR"}, "awayTeam": {"abbrev": "FLA"}} for game_id, kind, day, state in games]


def schedule_week(start, games):
    """The game feed's /schedule/{date}: the seven days from `start`."""
    from datetime import date, timedelta
    first = date.fromisoformat(start)
    days = [(first + timedelta(days=offset)).isoformat() for offset in range(7)]
    return {"gameWeek": [{"date": day, "games": [game for game in games if game["date"] == day]} for day in days]}


def roster_payload():
    def person(pid, first, last, position, number):
        return {"id": pid, "headshot": f"https://assets.nhle.com/mugs/nhl/20262027/CAR/{pid}.png",
                "firstName": {"default": first}, "lastName": {"default": last}, "sweaterNumber": number, "positionCode": position}
    return {"forwards": [person(STAAL, "Jordan", "Staal", "C", 11), person(AHO, "Sebastian", "Aho", "C", 20)],
            "defensemen": [person(SLAVIN, "Jaccob", "Slavin", "D", 74)], "goalies": [person(ANDERSEN, "Frederik", "Andersen", "G", 31)]}


def projection(pid, player, stat, line, team="CAR", opponent="FLA", start="2026-09-30T23:00:00Z", odds="standard"):
    return {"id": pid, "league": "NHL", "player": player, "stat": stat, "line": line, "odds_type": odds, "team": team,
            "team_name": "", "position": "C", "start_time": start, "description": opponent, "headshot": "",
            "updated_at": "2026-09-29T12:00:00Z", "combo": False}
