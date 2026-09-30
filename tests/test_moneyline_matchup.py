import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

import moneyline_matchup as mm
import moneyline_model as ml

START = datetime(2026, 10, 5, 17, 0, tzinfo=timezone.utc)


def page(**over):
    """An ESPN game page: Chiefs (home, id 12) and Bills (away, id 2)."""
    payload = {
        "header": {"competitions": [{"competitors": [
            {"homeAway": "home", "team": {"id": "12", "abbreviation": "KC"},
             "record": [{"type": "total", "summary": "4-1"}, {"type": "home", "summary": "3-0"}, {"type": "road", "summary": "1-1"}]},
            {"homeAway": "away", "team": {"id": "2", "abbreviation": "BUF"},
             "record": [{"type": "total", "summary": "3-2"}, {"type": "home", "summary": "2-0"}, {"type": "road", "summary": "1-2"}]}]}]},
        "predictor": {"homeTeam": {"id": "12", "gameProjection": "61.5"}, "awayTeam": {"id": "2", "gameProjection": "38.5"}},
        "lastFiveGames": [
            {"team": {"id": "12"}, "events": [
                {"gameDate": f"2026-09-{day:02d}T17:00Z", "gameResult": result, "score": score, "homeTeamId": "12" if home else "9",
                 "awayTeamId": "9" if home else "12", "homeTeamScore": hs, "awayTeamScore": aws, "opponent": {"abbreviation": "OPP"}}
                for day, result, score, home, hs, aws in [(7, "W", "30-10", True, "30", "10"), (14, "W", "27-17", False, "17", "27"),
                                                           (21, "W", "24-20", True, "24", "20"), (28, "L", "13-20", False, "20", "13")]]},
            {"team": {"id": "2"}, "events": [
                {"gameDate": f"2026-10-0{day}T00:15Z", "gameResult": "L", "score": "10-20", "homeTeamId": "2", "awayTeamId": "9",
                 "homeTeamScore": "10", "awayTeamScore": "20", "opponent": {"abbreviation": "OPP"}} for day in (1, 2, 3)]}],
        "seasonseries": [{"summary": "KC leads series 1-0", "events": [{"date": "2026-09-01T17:00Z", "competitors": [
            {"homeAway": "home", "team": {"abbreviation": "KC"}, "score": "31"}, {"homeAway": "away", "team": {"abbreviation": "BUF"}, "score": "17"}]}]}],
        "injuries": [{"team": {"id": "2"}, "injuries": [{"status": "Out", "athlete": {"displayName": "Josh Allen", "position": {"abbreviation": "QB"}}},
                                                        {"status": "Questionable", "athlete": {"displayName": "Role Player", "position": {"abbreviation": "WR"}}}]}],
        "leaders": [{"team": {"id": "2"}, "leaders": [
            {"name": "passingYards", "displayName": "Passing Yards", "leaders": [{"displayValue": "1,210", "athlete": {"displayName": "Josh Allen"}}]},
            {"name": "rushingYards", "displayName": "Rushing Yards", "leaders": [{"displayValue": "320", "athlete": {"displayName": "James Cook"}}]}]},
            {"team": {"id": "12"}, "leaders": [
            {"name": "passingYards", "displayName": "Passing Yards", "leaders": [{"displayValue": "1,300", "athlete": {"displayName": "Patrick Mahomes"}}]}]}],
    }
    payload.update(over)
    return payload


NAMES = {"home": "Chiefs", "away": "Bills"}


class SummaryTest(unittest.TestCase):
    def test_the_page_read_by_side(self):
        context = mm.parse_summary(page())
        self.assertAlmostEqual(context["predictor"]["home"], 0.615)
        self.assertEqual(context["sides"]["home"]["records"]["home"], "3-0")
        self.assertEqual([game["margin"] for game in context["form"]["home"]], [20, 10, 4, -7])
        self.assertEqual(context["series"]["summary"], "KC leads series 1-0")
        self.assertEqual(context["series"]["meetings"][0]["homeScore"], 31)
        self.assertEqual(context["injuries"]["away"][0], {"name": "Josh Allen", "status": "Out", "position": "QB"})
        self.assertEqual(context["leaders"]["away"]["passingyards"]["name"], "Josh Allen")
        self.assertEqual(mm.record_pct("10-6-2"), (10 / 18, 18))
        self.assertEqual(mm.record_pct(None), (None, 0))


class FactorsTest(unittest.TestCase):
    def setUp(self):
        self.context = mm.parse_summary(page())

    def test_a_missing_quarterback_moves_the_line_most(self):
        item = mm.injuries("nfl", self.context, NAMES)
        self.assertAlmostEqual(item["margin"], 5.5)   # Allen out: the Bills lose 5.5, the Chiefs gain it
        self.assertIn("Josh Allen (Out) leads Bills in passing yards", item["text"])

    def test_form_splits_and_rest(self):
        form = mm.form("nfl", self.context, {"home": 3.0, "away": 1.0})
        self.assertGreater(form["margin"], 0)          # Chiefs +6.75 lately against +3; Bills -10 against +1
        self.assertLessEqual(abs(form["margin"]), mm.CAPS["form"]["nfl"])
        split = mm.splits("nfl", self.context, 13.5)
        self.assertGreater(split["margin"], 0)          # 3-0 at home; 1-2 on the road
        # Bills played last night: a back-to-back in the NHL costs them.
        nhl = mm.rest("nhl", self.context, datetime(2026, 10, 4, 0, 0, tzinfo=timezone.utc), NAMES)
        self.assertEqual((nhl["margin"], nhl["detail"]["tired"]), (0.2, "away"))
        self.assertIsNone(mm.rest("mlb", self.context, START, NAMES))

    def test_head_to_head_counts_for_little(self):
        meetings = [{"homeScore": 31, "awayScore": 17, "homeIsHome": True}, {"homeScore": 20, "awayScore": 24, "homeIsHome": False}]
        item = mm.head_to_head("nfl", meetings, "Kansas City Chiefs", 2.0)
        self.assertGreater(item["margin"], 0)
        self.assertLessEqual(item["margin"], mm.CAPS["h2h"]["nfl"])
        self.assertIsNone(mm.head_to_head("nfl", meetings[:1], "Kansas City Chiefs", 2.0))

    def test_mlb_bullpens_and_lineups_against_the_starter(self):
        usage = {"116": {"innings": 14.0}, "114": {"innings": 7.0}, "147": {"innings": 9.0}}
        item = mm.bullpen(usage, "116", "114", {"home": "Tigers", "away": "Guardians"})
        self.assertLess(item["margin"], 0)             # the Tigers' pen is the tired one
        self.assertIn("Tigers' bullpen threw 14.0 innings", item["text"])
        splits = {"116": {"L": 0.690, "R": 0.740}, "114": {"L": 0.760, "R": 0.700}}
        hitting = {"116": {"ops": 0.720, "runsPerGame": 4.6}, "114": {"ops": 0.710, "runsPerGame": 4.2}}
        probables = {"116": {"hand": "L"}, "114": {"hand": "L"}}
        item = mm.platoon(splits, hitting, probables, "116", "114", {"home": "Tigers", "away": "Guardians"})
        self.assertLess(item["margin"], 0)             # both face lefties; the Guardians hit them better
        self.assertIn("Guardians hit .760 OPS against lefties (.710 overall)", item["text"])

    def test_nhl_likely_goalies(self):
        goalies = {"New York Rangers": [{"name": "Igor Shesterkin", "starts": 55, "savePct": 0.921, "shots": 1700},
                                        {"name": "Backup", "starts": 20, "savePct": 0.895, "shots": 600}],
                   "Boston Bruins": [{"name": "Jeremy Swayman", "starts": 50, "savePct": 0.905, "shots": 1500}]}
        rested = mm.goalie(goalies, "New York Rangers", "Boston Bruins", {}, {"home": "Rangers", "away": "Bruins"})
        tired = mm.goalie(goalies, "New York Rangers", "Boston Bruins", {"home": True}, {"home": "Rangers", "away": "Bruins"})
        self.assertGreater(rested["margin"], 0)
        self.assertLess(tired["margin"], 0)
        self.assertIn("likely backup", tired["text"])


def espn_event(event_id, home, away):
    return {"id": event_id, "date": "2026-09-30T23:05Z", "competitions": [{"status": {"type": {"state": "pre"}}, "competitors": [
        {"homeAway": "home", "team": {"displayName": home, "shortDisplayName": home.split()[-1], "abbreviation": home[:3].upper(), "logo": "h.png"},
         "records": [{"summary": "90-72"}]},
        {"homeAway": "away", "team": {"displayName": away, "shortDisplayName": away.split()[-1], "abbreviation": away[:3].upper(), "logo": "a.png"},
         "records": [{"summary": "88-74"}]}]}]}


class ScoreboardTest(unittest.TestCase):
    def setUp(self):
        ml._memory.clear()

    def test_one_day_a_request_and_a_bad_day_is_skipped(self):
        asked = []

        def espn(path, params):
            asked.append(params["dates"])
            if params["dates"] == "20260930":
                raise RuntimeError("timeout")
            return {"events": [espn_event("1", "New York Yankees", "Boston Red Sox")]}
        with mock.patch.object(ml, "_espn", side_effect=espn):
            games = ml.scoreboard("mlb", date(2026, 9, 29), date(2026, 10, 1))
        self.assertEqual(sorted(asked), ["20260929", "20260930", "20261001"])
        self.assertEqual(len(games), 1)          # the same game on two days is kept once
        with mock.patch.object(ml, "_espn", side_effect=RuntimeError("down")), self.assertRaises(RuntimeError):
            ml.scoreboard("mlb", date(2026, 10, 5), date(2026, 10, 6))

    def test_a_failed_read_is_not_kept(self):
        calls = []
        self.assertIsNone(mm.kept("probe", 600, lambda: calls.append(1)))
        self.assertIsNone(ml._load("ctx:probe"))
        mm._memory["probe"] = (0, None)
        self.assertEqual(mm.kept("probe", 600, lambda: {"ok": True}), {"ok": True})


class TeamFactsTest(unittest.TestCase):
    def setUp(self):
        ml._memory.clear()
        mm._memory.clear()

    def test_mlb_standings_and_last_five_from_the_schedule(self):
        rated = {"records": {"New York Yankees": {"id": "147", "abbr": "NYY", "short": "Yankees", "total": "94-68", "home": "50-31", "road": "44-37"},
                             "Boston Red Sox": {"id": "111", "abbr": "BOS", "short": "Red Sox", "total": "89-73", "home": "47-34", "road": "42-39"}}}
        games = [{"gameDate": f"2026-09-2{day}T23:05:00Z", "status": {"abstractGameState": "Final"},
                  "teams": {"home": {"team": {"id": 147}, "score": 5}, "away": {"team": {"id": 111}, "score": 3 + day % 4}}}
                 for day in range(1, 8)]
        with mock.patch("live_props_core.mlb", return_value={"dates": [{"games": games}]}):
            facts = mm.team_facts("mlb", rated, datetime(2026, 9, 30, 16, tzinfo=timezone.utc))
        yankees = facts["New York Yankees"]
        self.assertEqual((yankees["abbr"], yankees["short"], yankees["records"]["home"]), ("NYY", "Yankees", "50-31"))
        self.assertIn("/147.svg", yankees["logo"])
        self.assertEqual(len(yankees["form"]), 5)
        self.assertEqual(yankees["form"][-1]["date"], "2026-09-27T23:05:00Z")
        self.assertEqual(facts["Boston Red Sox"]["form"][-1]["opponent"], "NYY")

    def test_nfl_records_and_form_from_nflverse(self):
        rows = [{"season": "2026", "game_type": "REG", "gameday": f"2026-09-{day:02d}", "home_team": "KC", "away_team": "BUF",
                 "home_score": str(hs), "away_score": str(aws)} for day, hs, aws in ((7, 27, 20), (14, 17, 24), (21, 30, 10))]
        rows.append({"season": "2026", "game_type": "REG", "gameday": "2026-10-04", "home_team": "KC", "away_team": "BUF", "home_score": "", "away_score": ""})
        with mock.patch("backend.sports.nfl.finder.team_names", return_value={"KC": "Kansas City Chiefs", "BUF": "Buffalo Bills", "LA": "Los Angeles Rams"}), \
                mock.patch("backend.sports.nfl.finder.schedule_rows", return_value=rows):
            facts = mm.team_facts("nfl", {}, datetime(2026, 9, 30, tzinfo=timezone.utc))
        chiefs = facts["Kansas City Chiefs"]
        self.assertEqual((chiefs["records"]["total"], chiefs["records"]["home"]), ("2-1", "2-1"))
        self.assertEqual(facts["Buffalo Bills"]["records"]["road"], "1-2")
        self.assertEqual([game["result"] for game in chiefs["form"]], ["W", "L", "W"])
        self.assertTrue(facts["Los Angeles Rams"]["logo"].endswith("/lar.png"))

    def test_what_espn_leaves_out_is_filled_and_espn_wins_where_it_has_it(self):
        facts = {"New York Yankees": mm._team("New York Yankees", "Yankees", "NYY", "nyy.svg", {"total": "94-68", "home": "50-31", "road": "44-37"},
                                              [{"date": "2026-09-2%dT23:05:00Z" % day, "result": "W", "margin": 2} for day in range(3, 8)]),
                 "Boston Red Sox": mm._team("Boston Red Sox", "Red Sox", "BOS", "bos.svg", {"total": "89-73", "home": "47-34", "road": "42-39"})}
        game = {"homeName": "New York Yankees", "awayName": "Boston Red Sox"}
        filled = mm.fill(game, None, None, facts)
        self.assertEqual((filled["espn"]["away"]["short"], filled["espn"]["away"]["abbr"], filled["espn"]["away"]["record"]), ("Red Sox", "BOS", "89-73"))
        self.assertEqual(filled["context"]["sides"]["away"]["records"]["road"], "42-39")
        self.assertEqual(len(filled["context"]["form"]["home"]), 5)
        self.assertIsNotNone(mm.splits("mlb", filled["context"], 4.3))     # the model reads the filled records
        espn = {"home": {"name": "New York Yankees", "short": "Yankees", "abbr": "NY", "logo": "espn.png", "record": "94-68"}}
        page = {"sides": {"home": {"records": {"total": "94-68", "home": "51-30"}}}, "form": {"home": [{"result": "L", "margin": -1}] * 5}}
        filled = mm.fill(game, espn, page, facts)
        self.assertEqual((filled["espn"]["home"]["logo"], filled["espn"]["home"]["abbr"]), ("espn.png", "NY"))
        self.assertEqual(filled["context"]["sides"]["home"]["records"]["home"], "51-30")
        self.assertEqual(filled["context"]["form"]["home"][0]["result"], "L")
        self.assertEqual(mm.nickname("Toronto Maple Leafs"), "Maple Leafs")


class PostseasonTest(unittest.TestCase):
    def setUp(self):
        ml._memory.clear()
        mm._memory.clear()

    def test_the_scoreboard_knows_a_playoff_game(self):
        event = espn_event("9", "New York Yankees", "Boston Red Sox")
        event["season"] = {"type": 3}
        event["competitions"][0]["notes"] = [{"headline": "AL Wild Card - Game 2"}]
        event["competitions"][0]["series"] = {"summary": "NYY leads series 1-0"}
        with mock.patch.object(ml, "_espn", return_value={"events": [event]}):
            [game] = ml.scoreboard("mlb", date(2026, 9, 30), date(2026, 9, 30))
        self.assertEqual((game["postseason"], game["note"], game["series"]), (True, "AL Wild Card - Game 2", "NYY leads series 1-0"))

    def test_starters_go_shorter_and_bullpens_count_more(self):
        rated = {"ids": {"New York Yankees": "147"}, "probables": {"147": {"name": "Max Fried", "era": 2.8, "ip": 190}}, "staffs": {"147": {"era": 3.9}}}
        regular, _ = ml.starter_edge(rated, "New York Yankees")
        playoff, _ = ml.starter_edge(rated, "New York Yankees", ml.STARTER_INNINGS["postseason"])
        self.assertLess(playoff, regular)
        usage = {"147": {"innings": 12.0}, "111": {"innings": 6.0}, "143": {"innings": 9.0}}
        names = {"home": "Yankees", "away": "Red Sox"}
        self.assertGreater(abs(mm.bullpen(usage, "147", "111", names, weight=1.2)["margin"]), abs(mm.bullpen(usage, "147", "111", names)["margin"]))

    def test_form_is_shown_but_not_counted_in_the_playoffs(self):
        event = {"id": "g", "commence_time": "2026-09-30T23:05:00Z", "home_team": "New York Yankees", "away_team": "Boston Red Sox",
                 "bookmakers": [{"key": key, "markets": [{"key": "h2h", "outcomes": [{"name": "New York Yankees", "price": -125}, {"name": "Boston Red Sox", "price": 110}]}]}
                                for key in ("pinnacle", "draftkings", "fanduel")]}
        [game] = ml.parse_odds([event])
        rated = {"teams": {"New York Yankees": 0.6, "Boston Red Sox": 0.3}}
        hot = [{"date": f"2026-09-2{day}T23:05:00Z", "result": "W", "margin": 5} for day in range(3, 8)]
        context = {"form": {"home": hot, "away": [{**item, "result": "L", "margin": -5} for item in hot]}}
        regular = ml.read_game("mlb", game, rated, {"postseason": False}, context)
        playoff = ml.read_game("mlb", game, rated, {"postseason": True, "note": "AL Wild Card - Game 1"}, context)
        self.assertIn("form", [item["key"] for item in regular["matchup"]["factors"]])
        self.assertNotIn("form", [item["key"] for item in playoff["matchup"]["factors"]])
        self.assertEqual(len(playoff["matchup"]["teams"]["home"]["form"]), 5)     # still on the page

    def test_the_series_from_mlbs_schedule_when_espn_is_missing(self):
        rated = {"records": {"New York Yankees": {"id": "147", "abbr": "NYY", "short": "Yankees", "total": "94-68"},
                             "Boston Red Sox": {"id": "111", "abbr": "BOS", "short": "Red Sox", "total": "89-73"}}}

        def game(day, kind, state, home_runs=None, away_runs=None, number=None):
            return {"gameDate": f"2026-09-{day}T23:05:00Z", "gameType": kind, "status": {"abstractGameState": state},
                    "seriesDescription": "Wild Card", "seriesGameNumber": number, "gamesInSeries": 3,
                    "teams": {"home": {"team": {"id": 147}, "score": home_runs}, "away": {"team": {"id": 111}, "score": away_runs}}}
        schedule = [game(27, "R", "Final", 2, 6), game(29, "F", "Final", 5, 3, 1), game(30, "F", "Preview", number=2)]
        with mock.patch("live_props_core.mlb", return_value={"dates": [{"games": schedule}]}):
            facts = mm.team_facts("mlb", rated, datetime(2026, 9, 30, 16, tzinfo=timezone.utc))
        filled = mm.fill({"homeName": "New York Yankees", "awayName": "Boston Red Sox", "startsAt": "2026-09-30T23:05:00Z"}, None, None, facts)
        self.assertEqual((filled["espn"]["postseason"], filled["espn"]["note"], filled["espn"]["series"]),
                         (True, "Wild Card - Game 2", "NYY leads series 1-0"))


class ModelWithMatchupTest(unittest.TestCase):
    def test_the_matchup_moves_our_view_and_is_shown(self):
        event = {"id": "e", "commence_time": START.isoformat(), "home_team": "Kansas City Chiefs", "away_team": "Buffalo Bills",
                 "bookmakers": [{"key": key, "markets": [{"key": "h2h", "outcomes": [{"name": "Kansas City Chiefs", "price": home},
                                                                                     {"name": "Buffalo Bills", "price": away}]}]}
                                for key, home, away in (("pinnacle", -150, 135), ("draftkings", -155, 130), ("fanduel", -148, 128))]}
        [game] = ml.parse_odds([event])
        rated = {"teams": {"Kansas City Chiefs": 3.0, "Buffalo Bills": 1.0}, "rest": {},
                 "stats": {"Kansas City Chiefs": {"for": 27.0, "against": 18.0, "forRank": 3, "againstRank": 4, "teams": 32}},
                 "meetings": {tuple(sorted((ml.name_key("Kansas City Chiefs"), ml.name_key("Buffalo Bills")))): [
                     {"date": "2025-10-19", "homeName": "Buffalo Bills", "awayName": "Kansas City Chiefs", "homeScore": 20, "awayScore": 27}]}}
        context = mm.parse_summary(page())
        plain = ml.read_game("nfl", game, {**rated, "meetings": {}})
        read = ml.read_game("nfl", game, rated, context=context, opening={"home": 0.55, "at": "2026-10-01T00:00:00+00:00"})
        keys = [item["key"] for item in read["matchup"]["factors"]]
        self.assertIn("injuries", keys)
        self.assertIn("form", keys)
        self.assertGreater(read["model"]["margin"], plain["model"]["margin"] + 5)   # Allen out, among others
        self.assertAlmostEqual(read["model"]["espnHome"], 0.615)
        self.assertLessEqual(abs(read["model"]["tilt"]), ml.MAX_TILT + 1e-9)
        teams = read["matchup"]["teams"]
        self.assertEqual((teams["home"]["record"], teams["home"]["venueRecord"], teams["away"]["venueRecord"]), ("4-1", "3-0", "1-2"))
        self.assertEqual(teams["home"]["stats"]["forRank"], 3)
        self.assertEqual(teams["away"]["injuries"][0]["name"], "Josh Allen")
        self.assertEqual(read["matchup"]["h2h"]["meetings"][0]["homeIsHome"], False)
        self.assertEqual(read["matchup"]["movement"]["open"], 0.55)
        self.assertTrue(any("ESPN's model has" in reason for reason in read["reasons"]))
        self.assertTrue(any("Josh Allen (Out)" in reason for reason in read["reasons"]))

    def test_ranks(self):
        table = ml.ranked({"A": {"for": 30, "against": 20}, "B": {"for": 20, "against": 15}, "C": {"for": 25, "against": 25}})
        self.assertEqual((table["A"]["forRank"], table["B"]["againstRank"], table["C"]["againstRank"]), (1, 1, 3))


if __name__ == "__main__":
    unittest.main()
