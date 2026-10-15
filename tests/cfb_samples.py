"""ESPN college football responses, shaped as site.api.espn.com sends them
(scoreboard, team schedule, roster, game summary), for tests/test_cfb.py."""


def team(tid, abbr, location, nickname):
    return {"id": tid, "abbreviation": abbr, "displayName": f"{location} {nickname}", "shortDisplayName": location,
            "location": location, "name": nickname, "logo": f"https://a.espncdn.com/i/teamlogos/ncaa/500/{tid}.png"}


TEXAS, OKLAHOMA, ALABAMA, GEORGIA = team("251", "TEX", "Texas", "Longhorns"), team("201", "OU", "Oklahoma", "Sooners"), \
    team("333", "ALA", "Alabama", "Crimson Tide"), team("61", "UGA", "Georgia", "Bulldogs")


def event(eid, when, home, away, home_score=None, away_score=None, completed=False, year=2026, kind=2, schedule=False):
    def side(info, where, score):
        out = {"homeAway": where, "team": info}
        if score is not None:
            out["score"] = {"value": float(score), "displayValue": str(score)} if schedule else str(score)
            out["winner"] = score > (away_score if where == "home" else home_score)
        return out
    return {"id": eid, "date": when, "season": {"year": year, "type": kind}, "seasonType": {"type": kind},
            "competitions": [{"id": eid, "date": when, "neutralSite": False,
                              "competitors": [side(home, "home", home_score), side(away, "away", away_score)],
                              "status": {"type": {"completed": completed, "state": "post" if completed else "pre"}}}]}


SCOREBOARD = {"events": [event("401700001", "2026-10-17T19:30Z", OKLAHOMA, TEXAS),
                         event("401700002", "2026-10-17T19:30Z", ALABAMA, GEORGIA)]}

ROSTERS = {
    "251": {"athletes": [{"position": "offense", "items": [
        {"id": "4870906", "fullName": "Arch Manning", "jersey": "16", "position": {"abbreviation": "QB"}, "headshot": {"href": "https://img/arch.png"}},
        {"id": "5000001", "fullName": "Quintrevion Wisner", "jersey": "26", "position": {"abbreviation": "RB"}},
        {"id": "5000002", "fullName": "Ryan Wingo", "jersey": "5", "position": {"abbreviation": "WR"}}]},
        {"position": "specialTeam", "items": [{"id": "5000003", "fullName": "Mason Shipley", "jersey": "49", "position": {"abbreviation": "PK"}}]}]},
    "201": {"athletes": [{"position": "offense", "items": [
        {"id": "5100001", "fullName": "John Mateer", "jersey": "10", "position": {"abbreviation": "QB"}}]}]},
    "333": {"athletes": [{"position": "offense", "items": [
        {"id": "5200001", "fullName": "Ty Simpson", "jersey": "15", "position": {"abbreviation": "QB"}}]}]},
    "61": {"athletes": [{"position": "offense", "items": [
        {"id": "5300001", "fullName": "Gunner Stockton", "jersey": "14", "position": {"abbreviation": "QB"}}]}]},
}


def athlete(pid, name):
    return {"id": pid, "displayName": name, "jersey": "0", "headshot": {"href": f"https://img/{pid}.png"}}


def summary(texas_lines, opponent_id="201", opponent_passing=("8", "Other QB", "15/25", "180", "1", "1")):
    """A Texas game's summary: Texas's players' lines and the other side's quarterback."""
    def group(name, keys, labels, rows):
        return {"name": name, "keys": keys, "labels": labels, "athletes": [{"athlete": athlete(pid, who), "stats": stats} for pid, who, stats in rows]}
    passing = (["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns", "interceptions", "QBRating"],
               ["C/ATT", "YDS", "AVG", "TD", "INT", "QBR"])
    rushing = (["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"], ["CAR", "YDS", "AVG", "TD", "LONG"])
    receiving = (["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception"], ["REC", "YDS", "AVG", "TD", "LONG"])
    kicking = (["fieldGoalsMade/fieldGoalAttempts", "fieldGoalPct", "longFieldGoalMade", "extraPointsMade/extraPointAttempts", "totalKickingPoints"],
               ["FG", "PCT", "LONG", "XP", "PTS"])
    texas = [group(name, *spec, texas_lines.get(name, [])) for name, spec in
             (("passing", passing), ("rushing", rushing), ("receiving", receiving), ("kicking", kicking)) if texas_lines.get(name)]
    pid, who, cmp, yds, td, ints = opponent_passing
    other = [group("passing", *passing, [(pid, who, [cmp, yds, "7.2", td, ints, "120.1"])])]
    return {"boxscore": {
        "teams": [{"team": {"id": "251"}, "statistics": [{"name": "netPassingYards", "displayValue": "254"},
                                                        {"name": "rushingYards", "displayValue": "141"},
                                                        {"name": "totalYards", "displayValue": "395"},
                                                        {"name": "completionAttempts", "displayValue": "20-30"},
                                                        {"name": "rushingAttempts", "displayValue": "35"}]},
                  {"team": {"id": opponent_id}, "statistics": [{"name": "netPassingYards", "displayValue": yds},
                                                               {"name": "rushingYards", "displayValue": "90"},
                                                               {"name": "totalYards", "displayValue": "270"},
                                                               {"name": "completionAttempts", "displayValue": cmp.replace('/', '-')},
                                                               {"name": "rushingAttempts", "displayValue": "28"}]}],
        "players": [{"team": {"id": "251"}, "statistics": texas}, {"team": {"id": opponent_id}, "statistics": other}]}}


def manning(cmp, yds, td, ints, car, rush, rush_td="0", long_rush="12"):
    return {"passing": [("4870906", "Arch Manning", [cmp, yds, "8.5", td, ints, "160.2"])],
            "rushing": [("4870906", "Arch Manning", [car, rush, "4.0", rush_td, long_rush])]}
