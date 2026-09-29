"""NHL feed-shaped samples (api-web.nhle.com box score, play-by-play,
schedules, rosters; PrizePicks rows) for the NHL tests."""

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


def play(kind, period, clock, situation="1551", **details):
    return {"typeDescKey": kind, "periodDescriptor": {"number": period, "periodType": "REG" if period <= 3 else "OT"},
            "timeInPeriod": clock, "situationCode": situation, "details": details}


def pbp():
    plays = [
        play("faceoff", 1, "00:00", winningPlayerId=STAAL, losingPlayerId=BARKOV, eventOwnerTeamId=CAR_ID),
        play("shot-on-goal", 1, "02:10", shootingPlayerId=STAAL, goalieInNetId=BOBROVSKY, eventOwnerTeamId=CAR_ID),
        play("hit", 1, "03:00", hittingPlayerId=STAAL, hitteePlayerId=EKBLAD, eventOwnerTeamId=CAR_ID),
        # A home power play (four FLA skaters): Staal from Aho, 5:12 into the 1st.
        play("goal", 1, "05:12", situation="1451", scoringPlayerId=STAAL, assist1PlayerId=AHO, goalieInNetId=BOBROVSKY,
             eventOwnerTeamId=CAR_ID),
        play("faceoff", 1, "05:12", winningPlayerId=BARKOV, losingPlayerId=STAAL, eventOwnerTeamId=FLA_ID),
        play("faceoff", 2, "00:00", winningPlayerId=STAAL, losingPlayerId=BARKOV, eventOwnerTeamId=CAR_ID),
        play("missed-shot", 2, "01:00", shootingPlayerId=STAAL, eventOwnerTeamId=CAR_ID),
        play("blocked-shot", 2, "02:00", shootingPlayerId=STAAL, blockingPlayerId=EKBLAD, eventOwnerTeamId=FLA_ID),
        play("shot-on-goal", 2, "04:00", shootingPlayerId=BARKOV, goalieInNetId=ANDERSEN, eventOwnerTeamId=FLA_ID),
        # Even strength, FLA.
        play("goal", 2, "08:30", scoringPlayerId=BARKOV, goalieInNetId=ANDERSEN, eventOwnerTeamId=FLA_ID),
        play("goal", 2, "10:00", scoringPlayerId=SLAVIN, goalieInNetId=BOBROVSKY, eventOwnerTeamId=CAR_ID),
        play("shot-on-goal", 3, "10:00", shootingPlayerId=STAAL, goalieInNetId=BOBROVSKY, eventOwnerTeamId=CAR_ID),
        # A shorthanded goal for FLA (four FLA skaters against five).
        play("goal", 3, "12:00", situation="1451", scoringPlayerId=BARKOV, assist1PlayerId=EKBLAD, goalieInNetId=ANDERSEN,
             eventOwnerTeamId=FLA_ID),
        # FLA's goalie pulled for an extra attacker: Aho into the empty net,
        # at even strength.
        play("goal", 3, "19:00", situation="0651", scoringPlayerId=AHO, eventOwnerTeamId=CAR_ID),
    ]
    return {"homeTeam": {"id": CAR_ID, "abbrev": "CAR"}, "awayTeam": {"id": FLA_ID, "abbrev": "FLA"}, "plays": plays,
            "rosterSpots": [{"teamId": CAR_ID, "playerId": STAAL, "firstName": {"default": "Jordan"}, "lastName": {"default": "Staal"}},
                            {"teamId": FLA_ID, "playerId": BARKOV, "firstName": {"default": "Aleksander"}, "lastName": {"default": "Barkov"}}]}


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
