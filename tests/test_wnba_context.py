"""WNBA matchup research: pure functions only -- no network, no KV."""
import importlib.util
import unittest
from pathlib import Path

from backend.sports.wnba import context, league, matchup

_spec = importlib.util.spec_from_file_location("wnba_api", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
wnba_api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wnba_api)


def line(minutes, pts, reb=0, ast=0, starter=True, dnp=False, pid="p", name="Player", pos="G", team="AAA"):
    """One athlete entry as ESPN's box score gives it."""
    stats = [str(minutes), str(pts), "4-9", "1-3", "2-2", str(reb), str(ast), "1", "1", "0", "1", str(reb), "2", "+3"]
    return {"athlete": {"id": pid, "displayName": name, "position": {"abbreviation": pos},
                        "headshot": {"href": f"https://img/{pid}.png"}},
            "starter": starter, "didNotPlay": dnp, "stats": [] if dnp else stats}


KEYS = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
        "freeThrowsMade-freeThrowsAttempted", "rebounds", "assists", "turnovers", "steals", "blocks",
        "offensiveRebounds", "defensiveRebounds", "fouls", "plusMinus"]


def summary(home_entries, away_entries, plays=()):
    return {"boxscore": {"players": [
        {"team": {"id": "1", "abbreviation": "AAA"}, "statistics": [{"keys": KEYS, "athletes": home_entries}]},
        {"team": {"id": "2", "abbreviation": "BBB"}, "statistics": [{"keys": KEYS, "athletes": away_entries}]},
    ]}, "plays": list(plays)}


def shot(pid, team_id, x, y, points, made):
    return {"shootingPlay": True, "pointsAttempted": points, "scoringPlay": made,
            "participants": [{"athlete": {"id": pid}}], "team": {"id": team_id}, "coordinate": {"x": x, "y": y}}


class ZoneTests(unittest.TestCase):
    def test_zones(self):
        self.assertEqual(league.zone_of(25, 2, 2), "ra")
        self.assertEqual(league.zone_of(25, 10, 2), "paint")
        self.assertEqual(league.zone_of(40, 15, 2), "mid")
        self.assertEqual(league.zone_of(2, 3, 3), "c3l")
        self.assertEqual(league.zone_of(48, 1, 3), "c3r")
        self.assertEqual(league.zone_of(25, 25, 3), "ab3")
        # A wing three is above the break even near a sideline.
        self.assertEqual(league.zone_of(4, 14, 3), "ab3")


class ExtractTests(unittest.TestCase):
    def test_box_and_shots(self):
        players = {}
        data = summary(
            [line(30, 20, 5, 4, pid="a1"), line(0, 0, pid="a2", starter=False), line(0, 0, pid="a3", dnp=True)],
            [line(28, 11, pid="b1", pos="F")],
            [shot("a1", "1", 25, 2, 2, True), shot("a1", "1", 25, 25, 3, False), shot("b1", "2", 25, 10, 2, True),
             # Free throws and unlocated shots carry sentinel coordinates.
             shot("a1", "1", -214748340, -214748340, 2, True), {"shootingPlay": True, "pointsAttempted": 1}],
        )
        game = league.extract_game(data, {"id": "g1", "date": "2026-06-01T00:00Z", "type": 2, "home": "AAA", "away": "BBB"}, players)
        home = game["t"]["AAA"]
        self.assertEqual([row[0] for row in home["p"]], ["a1"])
        self.assertEqual(sorted(home["dnp"]), ["a2", "a3"])  # zero minutes counts as not playing
        row = home["p"][0]
        self.assertEqual(row[2:6], [30, 20, 5, 4])  # min, pts, reb, ast as whole numbers
        zones = {(pid, league.ZONES[z]): (m, a) for pid, z, m, a in home["z"]}
        self.assertEqual(zones, {("a1", "ra"): (1, 1), ("a1", "ab3"): (0, 1)})
        self.assertEqual(players["b1"][1], "F")
        self.assertEqual(players["a1"][3], "AAA")


def game(gid, date, home, away, home_rows, away_rows, zones=None):
    zones = zones or {}
    return {"id": gid, "date": date, "type": 2, "home": home, "away": away,
            "t": {home: {"p": home_rows, "dnp": [], "z": zones.get(home, [])},
                  away: {"p": away_rows, "dnp": [], "z": zones.get(away, [])}}}


def row(pid, minutes, pts, reb=0, ast=0, starter=1):
    values = {"min": minutes, "pts": pts, "reb": reb, "ast": ast, "fgm": 3, "fga": 8, "tpm": 1, "tpa": 3,
              "ftm": 1, "fta": 2, "stl": 1, "blk": 0, "to": 1, "pf": 2, "oreb": 0, "dreb": reb}
    return [pid, starter] + [values[field] for field in league.FIELDS]


class ContextTests(unittest.TestCase):
    def setUp(self):
        # AAA guard "star" plays BBB and CCC; BBB's guards score little on AAA.
        self.payload = {"season": 2026, "builtAt": "x", "teams": {}, "players": {
            "star": ["Star", "G", None, "AAA"], "mate": ["Mate", "C", None, "AAA"],
            "b_g": ["B Guard", "G", None, "BBB"], "c_g": ["C Guard", "G", None, "CCC"],
            "b_c": ["B Center", "C", None, "BBB"], "c_c": ["C Center", "C", None, "CCC"]},
            "games": {g["id"]: g for g in (
                game("1", "2026-06-01", "AAA", "BBB", [row("star", 30, 20), row("mate", 25, 10)], [row("b_g", 30, 5), row("b_c", 30, 8)],
                     {"AAA": [["star", 0, 3, 4], ["star", 5, 2, 6]], "BBB": [["b_g", 5, 1, 5]]}),
                game("2", "2026-06-03", "CCC", "AAA", [row("c_g", 30, 25), row("c_c", 30, 12)], [row("star", 32, 30)]),
                game("3", "2026-06-05", "BBB", "CCC", [row("b_g", 30, 9), row("b_c", 5, 2)], [row("c_g", 30, 15), row("c_c", 28, 6)]),
            )}}

    def test_defense_vs_position_ranks_least_allowed_first(self):
        ctx = context.league_context(self.payload)
        guards = {team: ctx["dvp"][team]["G"]["stats"]["pts"]["szn"] for team in ("AAA", "BBB", "CCC")}
        # Guards' points a game: AAA allowed 5 and 25 (15.0), BBB 20 and 15
        # (17.5), CCC 30 and 9 (19.5). The least allowed ranks first.
        self.assertEqual(guards["AAA"], [15.0, 1])
        self.assertEqual(guards["BBB"], [17.5, 2])
        self.assertEqual(guards["CCC"][1], 3)

    def test_position_defense_counts_the_whole_game(self):
        ctx = context.league_context(self.payload)
        # BBB's center scored 2 in 5 minutes against CCC: they count, since CCC
        # allowed them. AAA brought no center against CCC: a zero that game.
        self.assertEqual(ctx["dvp"]["CCC"]["C"]["stats"]["pts"]["szn"][0], 1.0)
        self.assertEqual(ctx["dvp"]["CCC"]["C"]["n"]["szn"], 1)

    def test_position_defense_adds_up_every_player_at_the_spot(self):
        # A fourth game: AAA plays two guards against CCC, 8 and 12 points -- 20 to guards that game.
        payload = {**self.payload, "players": {**self.payload["players"], "a_g2": ["A Guard 2", "G", None, "AAA"]},
                   "games": {**self.payload["games"],
                             "4": game("4", "2026-06-07", "AAA", "CCC", [row("star", 20, 8), row("a_g2", 30, 12)], [row("c_g", 30, 10)])}}
        ctx = context.league_context(payload)
        self.assertEqual(ctx["dvp"]["CCC"]["G"]["stats"]["pts"]["szn"][0], round((30 + 9 + 20) / 3, 2))
        # Tied teams share a rank.
        self.assertEqual(context._rank({"A": 1.0, "B": 2.0, "C": 2.0, "D": 3.0}, ascending=True), {"A": 1, "B": 2, "C": 2, "D": 4})
        # A player at a time (the Props tab's, as RotoBot counts it): CCC's
        # guards against them scored 30, 9, 8 and 12 -- 14.75 each.
        self.assertEqual(ctx["dvpEach"]["CCC"]["G"]["stats"]["pts"]["szn"][0], round((30 + 9 + 8 + 12) / 4, 2))

    def test_rotation_carries_each_players_recent_minutes(self):
        # The NBA score's who's-out reads: games played of the team's last
        # 10, minutes in them, and whether he played one of its last 3.
        rotation = {player["id"]: player for player in context.league_context(self.payload)["rotation"]["AAA"]["players"]}
        self.assertEqual((rotation["star"]["played10"], rotation["star"]["min10"], rotation["star"]["last3"]), (2, 31.0, True))
        self.assertEqual((rotation["mate"]["played10"], rotation["mate"]["min10"], rotation["mate"]["last3"]), (1, 25.0, True))
        # Off the current roster's path too.
        roster = {"mate": {"name": "Mate", "pos": "C"}, "b_g": {"name": "B Guard", "pos": "PG"},
                  **{f"rookie{n}": {"name": f"Rookie {n}", "pos": "SF"} for n in range(6)}}
        chart = {player["id"]: player for player in context.league_context(self.payload, rosters={"AAA": roster})["rotation"]["AAA"]["players"]}
        # B Guard played his games for BBB: none of AAA's last 10.
        self.assertEqual((chart["b_g"]["played10"], chart["b_g"]["last3"]), (0, False))
        self.assertEqual(chart["mate"]["played10"], 1)

    def test_last_ten_games_defense(self):
        from backend.sports.wnba import opportunity
        # Twelve AAA-BBB games: BBB scores 100 + n in game n. AAA's last 10
        # allowed 103..112 (107.5); four games aren't enough to read.
        games = {str(n): game(str(n), f"2026-06-{n + 1:02d}", "AAA", "BBB", [row("star", 30, 110)], [row("b_g", 30, 100 + n)]) for n in range(1, 13)}
        teams = opportunity.team_table(context.team_games({**self.payload, "games": games}))["teams"]
        self.assertEqual(teams["AAA"]["ptsAllowed10"][0], 107.5)
        self.assertIsNotNone(teams["AAA"]["drtg10"][0])
        few = opportunity.team_table(context.team_games(self.payload))["teams"]
        self.assertIsNone(few["AAA"]["ptsAllowed10"][0])

    def test_what_explains_rebounds_and_assists_allowed(self):
        from backend.sports.wnba import opportunity
        def boxed(pid, oreb, ast):
            line = row(pid, 30, 10, reb=oreb + 4, ast=ast)          # 3 of 8 shooting: 5 misses a player
            line[2 + league.FIELDS.index("oreb")] = oreb
            return line
        # AAA: two players, 6 baskets and 10 misses a game, 3 misses back, 4 assists.
        # BBB against them: 6 baskets, 10 misses, 1 back, 3 assists.
        games = {str(n): game(str(n), f"2026-06-0{n}", "AAA", "BBB", [boxed("star", 2, 3), boxed("mate", 1, 1)], [boxed("b_g", 1, 3), boxed("b_c", 0, 0)])
                 for n in (1, 2)}
        teams = opportunity.team_table(context.team_games({**self.payload, "games": games}))["teams"]
        aaa = {key: teams["AAA"][key][0] for key in ("fgm", "fgmAllowed", "orebPct", "orebAllowedPct", "assistedPct", "assistedAllowed")}
        self.assertEqual(aaa, {"fgm": 6.0, "fgmAllowed": 6.0, "orebPct": 30.0, "orebAllowedPct": 10.0, "assistedPct": 66.7, "assistedAllowed": 50.0})
        self.assertEqual(teams["AAA"]["orebPct"][1], 1)              # [value, rank], 1 the most

    def test_team_offense_and_defense_ranks(self):
        stats = context.league_context(self.payload)["teamStats"]
        # Team points per game: AAA 30, BBB 12, CCC 29 -- most ranks first.
        self.assertEqual(stats["AAA"]["off"]["pts"], [30.0, 1])
        # Allowed per game: AAA 25, BBB 25.5, CCC 20.5 -- least ranks first.
        self.assertEqual(stats["CCC"]["def"]["pts"], [20.5, 1])
        self.assertEqual(stats["AAA"]["def"]["pts"], [25.0, 2])

    def test_rotation_starts_with_last_starters(self):
        rotation = context.league_context(self.payload)["rotation"]["AAA"]["players"]
        self.assertEqual(rotation[0]["id"], "star")
        self.assertTrue(all(player["headshot"] for player in rotation))  # ESPN fallback when missing

    def test_rotation_reads_the_current_roster(self):
        # AAA now: Mate stays, B Guard signed from BBB, Star is gone, and
        # rookies who haven't played. Off-season-short rosters aren't used.
        roster = {"mate": {"name": "Mate", "pos": "C"}, "b_g": {"name": "B Guard", "pos": "PG"},
                  **{f"rookie{n}": {"name": f"Rookie {n}", "pos": "SF", "headshot": "x.png"} for n in range(6)}}
        chart = context.league_context(self.payload, rosters={"AAA": roster})["rotation"]["AAA"]["players"]
        ids = [player["id"] for player in chart]
        self.assertNotIn("star", ids)
        # Starters (guards first): the two who started their own last games, the signing among them.
        self.assertEqual(ids[:2], ["b_g", "mate"])
        self.assertTrue(all(player["lastStart"] for player in chart[:2]))
        self.assertFalse(any(player["lastStart"] for player in chart[2:]))
        signing = chart[0]
        self.assertEqual((signing["pos"], signing["games"], signing["min"]), ("G", 2, 30))
        self.assertEqual(chart[-1]["pos"], "F")              # ESPN's SF, as the page reads positions
        self.assertEqual(chart[-1]["min"], 0)
        short = context.league_context(self.payload, rosters={"AAA": {"mate": {"name": "Mate"}}})["rotation"]["AAA"]["players"]
        self.assertEqual(short[0]["id"], "star")

    def test_player_context(self):
        ctx = context.player_context(self.payload, "star", "AAA", "BBB", "player_points", 25.0)
        self.assertEqual(ctx["zones"]["ra"], [3, 4])
        self.assertEqual(ctx["zones"]["ab3"], [2, 6])
        mate = next(item for item in ctx["withWithout"] if item["id"] == "mate")
        self.assertEqual((mate["with"]["games"], mate["with"]["avg"]), (1, 20.0))
        self.assertEqual((mate["without"]["games"], mate["without"]["avg"], mate["without"]["hits"]), (1, 30.0, 1))
        self.assertEqual(mate["without"]["gameIds"], ["2"])
        # Similar guards vs BBB: CCC's guard (30 min) -- never the player herself.
        similar = ctx["similar"]["G"]
        self.assertEqual([entry["id"] for entry in similar], ["c_g"])
        self.assertEqual(similar[0]["value"], 15)
        self.assertEqual(similar[0]["avg"], 25.0)  # her average in her OTHER games

    def test_market_mapping_covers_the_board(self):
        # Every Odds API market, plus the ones only PrizePicks' feed posts;
        # a first-quarter or first-half line reads its whole-game market, and
        # dunks (the play-by-play's alone) have no matchup tables.
        from backend.sports.wnba import periods
        whole = {key for key in wnba_api.PRIZEPICKS_LABELS if key not in periods.PERIOD_FIELDS and key not in periods.PLAY_MARKETS}
        self.assertEqual(set(context.MARKET_STAT), whole)
        self.assertTrue({key.rsplit("_", 1)[0] for key in periods.PERIOD_FIELDS} <= set(context.MARKET_STAT))
        self.assertTrue(set(wnba_api.MARKETS) <= set(context.MARKET_STAT))


class TopUpTests(unittest.TestCase):
    def test_a_finished_but_unrecorded_game_is_due(self):
        from datetime import datetime, timedelta, timezone
        ago = lambda hours: (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%MZ")
        payload = lambda game: {"games": {"old": {}}, "schedule": [game]}
        self.assertTrue(league._game_due(payload({"id": "g", "date": ago(3)})))
        self.assertFalse(league._game_due(payload({"id": "g", "date": ago(1)})))      # still being played
        self.assertFalse(league._game_due(payload({"id": "old", "date": ago(3)})))    # already recorded
        # A long-postponed game never makes every read re-check.
        self.assertFalse(league._game_due(payload({"id": "g", "date": ago(24 * 5)})))


class PreseasonTests(unittest.TestCase):
    def test_preseason_games_stay_out_of_hit_rates(self):
        from unittest.mock import patch
        logs = [{"opponent": "OPP", "seasonKind": "preseason", "values": {"player_points": 4}},
                {"opponent": "OPP", "seasonKind": "regular", "values": {"player_points": 20}}]
        rows = [{"playerId": "test-only", "marketKey": "player_points", "line": 15,
                 "teamAbbr": "TEAM", "homeTeamAbbr": "OPP", "awayTeamAbbr": "TEAM"}]
        with patch.object(wnba_api, "_game_logs", return_value={"rows": logs}):
            result = wnba_api._attach_history(rows, 2026)[0]
        # Starters' short preseason minutes would make every Under look safe:
        # only the regular-season game counts (the chart still shows both).
        self.assertEqual(result["windows"]["season"]["sample"], 1)
        self.assertEqual(result["windows"]["season"]["hitRate"], 100)
        self.assertEqual(result["windows"]["h2h"]["sample"], 1)
        self.assertEqual(result["average"], 20)


class GameLogTests(unittest.TestCase):
    def test_attempts_two_pointers_and_fouls(self):
        from unittest.mock import patch
        names = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
                 "freeThrowsMade-freeThrowsAttempted", "totalRebounds", "assists", "blocks", "steals", "fouls", "turnovers", "points"]
        payload = {"names": names, "events": {"401": {"gameDate": "2026-08-01T23:00Z", "opponent": {"abbreviation": "LV"}, "atVs": "vs",
                                                     "gameResult": "W", "score": "90-80"}},
                   "seasonTypes": [{"displayName": "2026 Regular Season", "categories": [{"events": [
                       {"eventId": "401", "stats": ["32", "9-17", "3-7", "4-5", "6", "5", "1", "2", "3", "2", "25"]}]}]}]}
        with patch.object(wnba_api, "_espn_json", return_value=payload), patch.object(wnba_api.store, "get", return_value=None), \
                patch.object(wnba_api.store, "set"):
            values = wnba_api._game_logs("test-only-log", 2026)["rows"][0]["values"]
        self.assertEqual((values["player_field_goals_attempts"], values["player_frees_attempts"], values["player_fouls"]), (17, 5, 3))
        # Two-pointers: nine field goals, three of them threes.
        self.assertEqual((values["player_twos"], values["player_twos_attempts"]), (6, 10))
        # 25 points and 6 rebounds: one category in double figures.
        self.assertEqual(values["player_double_double"], 0)

    def test_offensive_and_defensive_rebounds_come_from_the_stored_box_scores(self):
        from unittest.mock import patch
        from backend.sports.wnba import league
        line = ["test-only-log", 1] + [None] * len(league.FIELDS)
        line[2 + league.FIELDS.index("oreb")], line[2 + league.FIELDS.index("dreb")] = 2, 7
        stored = {"games": {"401": {"id": "401", "t": {"LV": {"p": [line]}}}}}
        with patch.object(league, "stored", return_value=stored):
            self.assertEqual(wnba_api._rebound_split("test-only-log", 2026), {"401": (2, 7)})
        self.assertEqual(context.stat_value(["x", 1] + [12 if field in ("pts", "reb") else 3 for field in league.FIELDS], "dd"), 1)


class ScoreTests(unittest.TestCase):
    def test_scores_read_team_first(self):
        for flip in (wnba_api._own_score_first, matchup._own_score_first):
            self.assertEqual(flip("102-85", "L"), "85-102")
            self.assertEqual(flip("96-77", "W"), "96-77")
            self.assertEqual(flip("86-84 OT", "L"), "84-86 OT")
            self.assertIsNone(flip(None, "L"))


class GameNoteTests(unittest.TestCase):
    """The trend chart's game cards: usage rate, starter, who sat out."""

    def season(self):
        games = {}
        # Five games: the star "s" plays the first four, sits the fifth.
        for index in range(5):
            mine = [row("me", 30, 20, starter=1), row("b", 30, 10, starter=0), row("c", 30, 6),
                    row("d", 30, 4), row("e", 30, 2)]
            if index < 4:
                mine.append(row("s", 36, 25))
            games[f"g{index}"] = game(f"g{index}", f"2026-03-0{index + 1}", "AAA", "BBB", mine, [row("x", 40, 10)])
            if index == 4:
                games["g4"]["t"]["AAA"]["dnp"] = ["s", "bench"]
        return {"games": games, "players": {"s": ["Star Scorer", "F", None, "AAA"], "bench": ["Deep Bench", "G", None, "AAA"]}}

    def test_usage_starter_and_who_sat(self):
        notes = context.game_notes([None, self.season()], "me")
        self.assertEqual(sorted(notes), ["g0", "g1", "g2", "g3", "g4"])
        # Every player the same shots, trips and turnovers: his share is one in five
        # with six playing, scaled by minutes (30 of the team's 186 / 5).
        first = notes["g0"]
        self.assertTrue(first["started"])
        self.assertEqual(first["usage"], round(100 * (8 + 0.44 * 2 + 1) * (186 / 5) / (30 * 6 * (8 + 0.44 * 2 + 1)), 1))
        self.assertEqual(first["out"], [])
        # The star sat the fifth: listed with his scoring. The deep bench
        # player never played enough to count.
        self.assertEqual(notes["g4"]["out"], [{"id": "s", "name": "Star Scorer", "pos": "F", "ppg": 25.0}])

    def test_no_minutes_no_usage(self):
        self.assertIsNone(context.usage_rate(row("me", 0, 0), [row("me", 0, 0)]))
        self.assertEqual(context.game_notes([None, None], "me"), {})


def box(pid, **values):
    """A player's stored line with every field given (the rest zero)."""
    full = {field: 0 for field in league.FIELDS}
    full.update(values)
    return [pid, 1] + [full[field] for field in league.FIELDS]


class OpportunityTests(unittest.TestCase):
    """One game worked out by hand: AAA (star 24 minutes, the rest of the
    team 216) against BBB. A 48-minute game, so star played half of it."""

    def setUp(self):
        from backend.sports.wnba import opportunity
        self.opportunity = opportunity
        star = box("star", min=24, pts=13, reb=6, oreb=1, dreb=5, ast=4, fgm=5, fga=10, tpm=1, tpa=2, ftm=2, fta=4, to=2)
        rest = box("mate", min=216, pts=36, reb=24, oreb=4, dreb=20, ast=10, fgm=15, fga=30, tpm=2, tpa=6, ftm=4, fta=6, to=8)
        them = box("opp", min=240, pts=50, reb=40, oreb=10, dreb=30, ast=12, fgm=20, fga=50, tpm=6, tpa=20, ftm=4, fta=10, to=5)
        self.payload = {"season": 2026, "builtAt": "x", "teams": {}, "players": {
            "star": ["Star", "G", None, "AAA"], "mate": ["Mate", "C", None, "AAA"], "opp": ["Opp", "F", None, "BBB"]},
            "games": {"1": game("1", "2026-01-01", "AAA", "BBB", [star, rest], [them])}}

    def test_possessions_and_ratings(self):
        table = context.league_context(self.payload)["opportunity"]
        aaa, bbb = table["teams"]["AAA"], table["teams"]["BBB"]
        # Trips: 40 shots - 5 offensive boards + 10 turnovers + 0.44 x 10 free throws = 49.4 (BBB the same).
        self.assertEqual(aaa["poss"][0], 49.4)
        self.assertEqual(aaa["ortg"][0], 99.2)   # 49 points on 49.4 trips, per 100
        self.assertEqual(aaa["drtg"][0], 101.2)  # 50 allowed
        self.assertEqual(aaa["miss"], [20, 2])          # AAA missed 20; BBB missed more
        self.assertEqual(aaa["missAllowed"], [30, 1])   # and made BBB miss 30, the most
        self.assertEqual(aaa["gameMiss"][0], 50)
        self.assertEqual(aaa["tpaAllowed"][0], 20)
        self.assertEqual(table["count"], 2)

    def test_his_shares(self):
        chances = context.player_context(self.payload, "star", "AAA", "BBB", "player_rebounds", 5.5)["opportunity"]["szn"]
        self.assertEqual(chances["usage"], 50.6)       # (10 + 0.44x4 + 2) x 48 / (24 x 54.4)
        self.assertEqual(chances["rebShare"], 17.1)    # 6 of the 35 rebounds while he played
        self.assertEqual(chances["orebShare"], 5.7)
        self.assertEqual(chances["drebShare"], 28.6)
        self.assertEqual(chances["astShare"], 80.0)    # 4 of teammates' 5 baskets while he played
        self.assertEqual(chances["missesOn"], 25.0)    # half the game's 50 misses
        self.assertEqual(chances["possOn"], 24.7)
        self.assertEqual(chances["mateFg"], 50.0)      # teammates 15 of 30
        self.assertEqual(chances["per36"]["pts"], 19.5)
        self.assertEqual((chances["games"], chances["fga"], chances["fta"]), (1, 10, 4))

    def test_splits_carry_his_chances(self):
        later = game("2", "2026-01-03", "AAA", "BBB",
                     [box("star", min=36, pts=30, fga=22, fgm=11, fta=8, ftm=6, to=3, reb=5, dreb=5)],
                     [box("opp", min=240, pts=40, fga=45, fgm=15, reb=40, dreb=30, oreb=10)])
        payload = {**self.payload, "games": {**self.payload["games"], "2": later}}
        mate = next(item for item in context.player_context(payload, "star", "AAA", "BBB", "player_points", 20.5)["withWithout"]
                    if item["id"] == "mate")
        self.assertEqual(mate["without"]["chances"]["fga"], 22)
        self.assertEqual(mate["without"]["chances"]["min"], 36)
        self.assertEqual(mate["with"]["chances"]["fga"], 10)

    def test_last_season_joins_a_young_one(self):
        previous = {"season": 2025, "players": {"star": ["Star", "G", None, "OLD"]},
                    "games": {"0": game("0", "2025-03-01", "AAA", "BBB", [box("star", min=30, fga=12, fgm=6)], [box("opp", min=240)])}}
        blended = self.opportunity.blend(previous, self.payload)
        self.assertEqual(blended["blended"], [2025, 2026])
        self.assertEqual(blended["players"]["star"][3], "AAA")  # where he plays now
        ctx = context.player_context(blended, "star", "AAA", "BBB", "player_points", 12.5)
        self.assertEqual(ctx["opportunity"]["games"], 2)
        self.assertEqual(ctx["opportunity"]["seasons"], [2025, 2026])
        self.assertEqual(ctx["seasons"], [2025, 2026])
        self.assertIs(self.opportunity.blend(None, self.payload), self.payload)


class FakeStore:
    def __init__(self):
        self.values = {}

    def get(self, key, **_):
        return self.values.get(key)

    def pipeline(self, commands, **_):
        for command in commands:
            self.values[command[1]] = command[2]


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


def tracking_answer(measure, last):
    """stats.nba.com's leaguedashptstats, as the NBA's site answers it."""
    from backend.sports.wnba import tracking
    columns = list(tracking.MEASURES[measure])
    values = {"POTENTIAL_AST": 11.2 if not last else 12.6, "AST": 7.1, "REB_CHANCES": 15.0, "REB": 9.8, "REB_CHANCE_PCT": 0.653,
              "REB_CONTEST_PCT": 0.41, "CATCH_SHOOT_FG3A": 4.2, "CATCH_SHOOT_FG3_PCT": 0.389, "TOUCHES": 70.4, "TIME_OF_POSS": 6.1}
    rows = [[201, "Nikola Jokić", "DEN", 20 if not last else 10, 34.5] + [values.get(column, 1.0) for column in columns],
            [202, "Someone Else", "BOS", 30, 30.0] + [1.0 for _ in columns]]
    return {"resource": "leaguedashptstats",
            "resultSets": [{"name": "LeagueDashPtStats", "headers": ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GP", "MIN"] + columns,
                            "rowSet": rows}]}


class TrackingTests(unittest.TestCase):
    def setUp(self):
        from backend.sports.wnba import tracking
        self.tracking = tracking
        self.calls = []

    def get(self, url, params=None, **_):
        self.calls.append((params["PtMeasureType"], params["Season"], params["LastNGames"]))
        return FakeResponse(tracking_answer(params["PtMeasureType"], params["LastNGames"]))

    def test_season_names_and_player_names(self):
        self.assertEqual(self.tracking.season_label(2026), "2025-26")
        self.assertEqual(self.tracking.name_key("Nikola Jokić"), self.tracking.name_key("Nikola Jokic"))
        self.assertEqual(self.tracking.name_key("Jaren Jackson Jr."), "jaren jackson")

    def test_a_player_read_off_the_nba_tables(self):
        store = FakeStore()
        found = self.tracking.player(2026, "Nikola Jokic", "DEN", get=self.get, store=store)
        self.assertTrue(found["available"])
        self.assertEqual(found["season"], "2025-26")
        self.assertEqual(found["games"], 20)
        self.assertEqual(found["passing"]["potentialAst"], 11.2)
        self.assertEqual(found["recent"]["passing"]["potentialAst"], 12.6)
        self.assertEqual(found["recent"]["games"], 10)
        self.assertEqual(found["rebounding"]["chancePct"], 65.3)   # a fraction on the NBA's site
        self.assertEqual(found["catchShoot"]["fg3Pct"], 38.9)
        self.assertEqual(found["touches"]["timeOfPoss"], 6.1)
        asked = len(self.calls)
        self.assertEqual(asked, len(self.tracking.MEASURES) + len(self.tracking.RECENT_MEASURES))
        # Kept: a second page asks nothing.
        self.tracking.player(2026, "Nikola Jokic", "DEN", get=self.get, store=store)
        self.assertEqual(len(self.calls), asked)

    def test_a_refusal_is_remembered(self):
        store = FakeStore()

        def refused(*_, **__):
            self.calls.append("refused")
            raise RuntimeError("timed out")
        self.assertEqual(self.tracking.player(2026, "Nikola Jokic", get=refused, store=store), {"available": False, "reason": "unreachable"})
        tried = len(self.calls)
        self.tracking.player(2026, "Nikola Jokic", get=refused, store=store)
        self.assertEqual(len(self.calls), tried)

    def test_a_young_season_reads_last_one(self):
        def young(url, params=None, **_):
            if params["Season"] == "2026-27":
                return FakeResponse({"resultSets": [{"headers": ["PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GP"], "rowSet": []}]})
            return self.get(url, params)
        found = self.tracking.player(2027, "Nikola Jokic", "DEN", get=young, store=FakeStore())
        self.assertEqual(found["season"], "2025-26")  # 2026-27 has none of his games yet
        self.assertTrue(found["available"])
        self.assertEqual(self.tracking.player(2026, "Nobody Here", get=self.get, store=FakeStore())["reason"], "not-found")


class RestTableTests(unittest.TestCase):
    def test_each_teams_games_near_today(self):
        from datetime import datetime, timezone
        now = datetime(2026, 10, 26, 12, tzinfo=timezone.utc)
        schedule = [{"id": "1", "date": "2026-10-25T23:30Z", "home": "IND", "away": "NO"},
                    {"id": "2", "date": "2026-10-27T00:00Z", "home": "NO", "away": "IND"},
                    {"id": "3", "date": "2026-09-01T00:00Z", "home": "IND", "away": "BOS"},
                    {"id": "4", "date": "not a date", "home": "IND", "away": "BOS"}]
        table = context.rest_table(schedule, now)
        self.assertEqual(table["IND"], ["2026-10-25T23:30Z", "2026-10-27T00:00Z"])
        self.assertNotIn("BOS", table)
        self.assertEqual(context.rest_table(None, now), {})


if __name__ == "__main__":
    unittest.main()
