"""NBA in the Finder: PrizePicks' lines on ESPN's players and games, two
seasons of game logs, and the season of box scores kept a month per record.
No network: ESPN, PrizePicks and the store are stand-ins."""
import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from backend.sports.wnba import context, league, matchup

_spec = importlib.util.spec_from_file_location("wnba_api_nba", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(api)

NOW = datetime(2026, 11, 3, 16, tzinfo=timezone.utc)
DIRECTORY = {
    "players": {
        "stephen curry": [{"id": "3975", "name": "Stephen Curry", "team": "Golden State Warriors", "teamAbbr": "GS",
                           "teamLogo": "gs.png", "headshot": "curry.png", "position": "G", "height": "6'2", "jersey": "30"}],
        # Two players of one name: the line's team decides.
        "jalen williams": [{"id": "1", "name": "Jalen Williams", "team": "Oklahoma City Thunder", "teamAbbr": "OKC"},
                           {"id": "2", "name": "Jalen Williams", "team": "Phoenix Suns", "teamAbbr": "PHX"}],
    },
    "teams": {"golden state warriors": {"name": "Golden State Warriors", "abbr": "GS", "logo": "gs.png"},
              "los angeles lakers": {"name": "Los Angeles Lakers", "abbr": "LAL", "logo": "lal.png"},
              "phoenix suns": {"name": "Phoenix Suns", "abbr": "PHX", "logo": "phx.png"}},
}


def pp(stat, line, player="Stephen Curry", team="GSW", start="2026-11-04T03:00:00Z", **extra):
    return {"id": f"{player}:{stat}:{line}", "player": player, "stat": stat, "line": line, "odds_type": "standard",
            "team": team, "start_time": start, "updated_at": "2026-11-03T15:00:00Z", "headshot": "pp.png", **extra}


def espn_day(*games):
    return {"events": [{"id": game_id, "date": start, "competitions": [{"competitors": [
        {"homeAway": "home", "team": {"abbreviation": home, "displayName": home_name, "logo": f"{home.lower()}.png"}},
        {"homeAway": "away", "team": {"abbreviation": away, "displayName": away_name, "logo": f"{away.lower()}.png"}}]}]}
        for game_id, start, home, home_name, away, away_name in games]}


GAME = ("401", "2026-11-04T03:00Z", "GS", "Golden State Warriors", "LAL", "Los Angeles Lakers")


class SeasonTests(unittest.TestCase):
    def test_the_season_a_page_shows(self):
        # ESPN names an NBA season by the year it ends; the new one counts from tip-off week.
        self.assertEqual(league.current_season(datetime(2026, 9, 30, tzinfo=timezone.utc), "nba"), 2026)
        self.assertEqual(league.current_season(datetime(2026, 10, 21, tzinfo=timezone.utc), "nba"), 2027)
        self.assertEqual(league.current_season(datetime(2027, 3, 1, tzinfo=timezone.utc), "nba"), 2027)
        self.assertEqual(league.current_season(datetime(2026, 9, 30, tzinfo=timezone.utc)), 2026)   # WNBA unchanged

    def test_history_covers_this_season_and_last(self):
        self.assertEqual(api._nba_seasons(datetime(2026, 9, 30, tzinfo=timezone.utc)), [2026, 2027])
        self.assertEqual(api._nba_seasons(datetime(2027, 2, 1, tzinfo=timezone.utc)), [2026, 2027])
        self.assertEqual(api._nba_seasons(datetime(2026, 7, 1, tzinfo=timezone.utc)), [2025, 2026])

        def logs(player_id, season, league_name):
            self.assertEqual(league_name, "nba")
            return {"rows": [{"gameId": f"{season}-1", "date": f"{season - 1}-12-01T00:00Z"},
                             {"gameId": "shared", "date": f"{season}-01-01T00:00Z"}]}
        with patch.object(api, "_game_logs", side_effect=logs), \
                patch.object(api, "_nba_seasons", return_value=[2026, 2027]):
            rows = api._history("3975", "nba")
        self.assertEqual([row["gameId"] for row in rows], ["2026-1", "shared", "2027-1"])


class BoardTests(unittest.TestCase):
    def setUp(self):
        api._nba_memory.update(at=0.0, value=None)
        api._nba_days.clear()

    def board(self, lines, games=(GAME,), directory=DIRECTORY):
        with patch("prizepicks_export_core._fetch_projection_rows", return_value=lines), \
                patch.object(api, "_roster_directory", return_value=directory), \
                patch.object(api, "_espn_json", return_value=espn_day(*games)), \
                patch.object(api, "datetime") as clock:
            clock.now.return_value = NOW
            clock.fromisoformat = datetime.fromisoformat
            return api._nba_board()

    def test_every_prizepicks_stat_on_espns_player_and_game(self):
        lines = [pp("Points", 26.5), pp("Pts+Rebs+Asts", 37.5, odds_type="goblin"), pp("3-PT Made", 4.5),
                 pp("Triple-Double", 0.5), pp("Dunks", 0.5), pp("Blocked Shots", 0.5),
                 # Combo lines and games already started are left out.
                 pp("Points", 50.5, player="Stephen Curry + LeBron James", combo=True),
                 pp("Points", 20.5, start="2026-11-03T12:00:00Z")]
        board = self.board(lines)
        self.assertEqual(board["sport"], "nba")
        rows = {row["market"]: row for row in board["rows"]}
        self.assertEqual(set(rows), {"Points", "Pts+Rebs+Asts", "3-PT Made", "Triple-Double", "Dunks", "Blocked Shots"})
        points = rows["Points"]
        self.assertEqual((points["marketKey"], points["playerId"], points["teamAbbr"], points["team"]),
                         ("player_points", "3975", "GS", "Golden State Warriors"))
        self.assertEqual((points["eventId"], points["homeTeamAbbr"], points["awayTeamAbbr"], points["awayTeam"]),
                         ("401", "GS", "LAL", "Los Angeles Lakers"))
        self.assertEqual(points["jersey"], "30")  # the matchup page's banner
        self.assertEqual(rows["Pts+Rebs+Asts"]["marketKey"], "player_points_rebounds_assists")
        self.assertEqual(rows["Pts+Rebs+Asts"]["modifier"], "goblin")
        self.assertEqual(rows["Triple-Double"]["marketKey"], "player_triple_double")
        self.assertEqual(rows["Blocked Shots"]["marketKey"], "player_blocks")
        self.assertEqual(rows["Dunks"]["marketKey"], "player_dunks")   # counted from the play-by-play (periods.dunk_counts)
        self.assertEqual(points["apps"][0]["key"], "prizepicks")

    def test_same_name_players_are_told_apart_by_team_and_unknowns_still_show(self):
        lines = [pp("Points", 18.5, player="Jalen Williams", team="PHO"), pp("Rebounds", 5.5, player="New Rookie", team="LAL")]
        game = ("402", "2026-11-04T03:00Z", "PHX", "Phoenix Suns", "LAL", "Los Angeles Lakers")
        rows = {row["player"]: row for row in self.board(lines, games=(game,))["rows"]}
        self.assertEqual((rows["Jalen Williams"]["playerId"], rows["Jalen Williams"]["teamAbbr"]), ("2", "PHX"))
        rookie = rows["New Rookie"]
        self.assertNotIn("playerId", rookie)
        self.assertEqual((rookie["teamAbbr"], rookie["team"], rookie["headshot"], rookie["eventId"]),
                         ("LAL", "Los Angeles Lakers", "pp.png", "402"))

    def test_an_empty_slate_is_an_empty_board(self):
        with patch("prizepicks_export_core._fetch_projection_rows", side_effect=RuntimeError("PrizePicks returned no active NBA projections.")), \
                patch.object(api, "_roster_directory", return_value=DIRECTORY):
            self.assertEqual(api._nba_board()["rows"], [])


class RosterTests(unittest.TestCase):
    def test_each_player_carries_his_jersey_number(self):
        teams = {"sports": [{"leagues": [{"teams": [{"team": {"id": "9", "displayName": "Golden State Warriors", "abbreviation": "GS",
                                                             "logos": [{"rel": ["default"], "href": "gs.png"}]}}]}]}]}
        roster = {"athletes": [{"id": "3975", "displayName": "Stephen Curry", "jersey": "30", "displayHeight": "6' 2\"",
                                "position": {"abbreviation": "G"}, "headshot": {"href": "curry.png"}},
                               {"id": "77", "displayName": "Two Way", "position": {"abbreviation": "F"}}]}
        api._roster_memory.pop("nba", None)
        with patch.object(api, "_espn_json", side_effect=lambda url: roster if url.endswith("/roster") else teams), \
                patch.object(api.store, "get", return_value=None), patch.object(api.store, "set"):
            players = api._roster_directory("nba")["players"]
        api._roster_memory.pop("nba", None)
        self.assertEqual((players["stephen curry"][0]["jersey"], players["stephen curry"][0]["height"]), ("30", "6'2"))
        self.assertIsNone(players["two way"][0]["jersey"])  # none listed yet


class GameLogTests(unittest.TestCase):
    def test_nba_logs_read_espns_nba_path_and_count_triple_doubles(self):
        asked = []
        names = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
                 "freeThrowsMade-freeThrowsAttempted", "totalRebounds", "assists", "blocks", "steals", "fouls", "turnovers", "points"]
        payload = {"names": names, "events": {"401": {"gameDate": "2026-04-01T23:00Z", "opponent": {"abbreviation": "LAL"},
                                                     "atVs": "vs", "gameResult": "W", "score": "120-110"}},
                   "seasonTypes": [{"displayName": "2025-26 Play In Tournament", "categories": [{"events": [
                       {"eventId": "401", "stats": ["38", "10-20", "2-6", "4-4", "12", "11", "1", "2", "3", "4", "26"]}]}]}]}

        def espn(url):
            asked.append(url)
            return payload
        with patch.object(api, "_espn_json", side_effect=espn), patch.object(api.store, "get", return_value=None), \
                patch.object(api.store, "set"), patch.object(league, "stored", return_value=None):
            row = api._game_logs("test-nba", 2026, "nba")["rows"][0]
        self.assertIn("/basketball/nba/athletes/test-nba/gamelog", asked[0])
        self.assertEqual((row["values"]["player_triple_double"], row["values"]["player_double_double"]), (1.0, 1.0))
        self.assertEqual(row["seasonKind"], "postseason")
        self.assertEqual(context.stat_value(["x", 1] + [12 if field in ("pts", "reb", "ast") else 3 for field in league.FIELDS], "td"), 1)


class FakeStore:
    KV_URL = KV_TOKEN = ""

    def __init__(self):
        self.data, self.writes = {}, []

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.writes.append(key)
        self.data[key] = value
        return True


class MonthlySeasonTests(unittest.TestCase):
    def setUp(self):
        league._memory.clear()

    def test_the_nba_season_is_kept_a_month_per_record(self):
        store = FakeStore()
        schedule = [{"id": "g1", "date": "2025-10-22T23:00Z", "type": 2, "completed": True, "home": "GS", "away": "LAL"},
                    {"id": "g2", "date": "2025-11-02T23:00Z", "type": 2, "completed": True, "home": "LAL", "away": "GS"},
                    {"id": "g3", "date": "2025-11-05T23:00Z", "type": 2, "completed": False, "home": "GS", "away": "LAL"}]
        extract = lambda summary, game, players: {"id": game["id"], "date": game["date"], "t": {}}
        with patch.object(league, "_store", return_value=store), patch.object(league, "team_directory", return_value={}), \
                patch.object(league, "schedule", return_value=schedule), patch.object(league, "espn", return_value={}), \
                patch.object(league, "extract_game", side_effect=extract):
            built = league.build(2026, deadline_seconds=None, league="nba")
            self.assertEqual(set(built["games"]), {"g1", "g2"})
            self.assertTrue(built["stored"])
            self.assertEqual(sorted(store.writes), ["krazy_data:nba:v1:league:2026", "krazy_data:nba:v1:league:2026:2025-10",
                                                    "krazy_data:nba:v1:league:2026:2025-11"])
            league._memory.clear()
            again = league.stored(2026, "nba")
            self.assertEqual((set(again["games"]), again["months"]), ({"g1", "g2"}, ["2025-10", "2025-11"]))
            # g3 finishes: only its month and the index are written again.
            schedule[2]["completed"] = True
            store.writes.clear()
            league.build(2026, deadline_seconds=None, league="nba")
            self.assertEqual(sorted(store.writes), ["krazy_data:nba:v1:league:2026", "krazy_data:nba:v1:league:2026:2025-11"])
            league._memory.clear()
            self.assertEqual(set(league.stored(2026, "nba")["games"]), {"g1", "g2", "g3"})
        # The WNBA keeps its one record.
        self.assertFalse(league.LEAGUES["wnba"]["monthly"])

    def test_the_timer_checks_only_the_season_summary(self):
        store = FakeStore()
        store.data["krazy_data:nba:v1:league:2026"] = league._encode({"partial": True, "months": ["2025-10"]})
        store.data["krazy_data:nba:v1:league:2026:2025-10"] = league._encode({"g1": {}})
        read = []
        get = store.get
        store.get = lambda key: read.append(key) or get(key)
        league._progress.clear()
        with patch.object(league, "_store", return_value=store):
            self.assertEqual(league.progress(2026, "nba"), {"partial": True})
            store.data["krazy_data:nba:v1:league:2026"] = league._encode({"partial": False, "months": ["2025-10"]})
            self.assertEqual(league.progress(2026, "nba"), {"partial": False})
            # A finished season is not read again for half an hour.
            self.assertEqual(league.progress(2026, "nba"), {"partial": False})
            self.assertIsNone(league.progress(2027, "nba"))
        self.assertEqual(read, ["krazy_data:nba:v1:league:2026"]*2 + ["krazy_data:nba:v1:league:2027"])
        store.get = lambda key: (_ for _ in ()).throw(ConnectionError())
        with patch.object(league, "_store", return_value=store), self.assertRaises(ConnectionError):
            league.progress(2028, "nba")

    def test_team_schedules_make_the_nba_season(self):
        asked = []

        def espn(path, params=None, timeout=15, league="wnba"):
            asked.append((path, params["seasontype"], league))
            final = {"type": {"completed": True, "name": "STATUS_FINAL"}}
            return {"events": [{"id": "g1", "date": "2025-10-22T23:00Z", "competitions": [{"status": final, "competitors": [
                {"homeAway": "home", "team": {"id": "9", "abbreviation": "GS"}},
                {"homeAway": "away", "team": {"id": "13", "abbreviation": "LAL"}}]}]}]}
        teams = {"GS": {"id": "9"}, "LAL": {"id": "13"}}
        with patch.object(league, "espn", side_effect=espn):
            games = league.schedule(2026, teams, "nba")
        self.assertEqual(len(games), 1)             # both teams list the same game once
        self.assertEqual(games[0]["type"], 2)       # every schedule asked for both season types; g1 kept its first
        self.assertEqual({item[1] for item in asked}, {2, 3})
        self.assertTrue(all(item[0].startswith("/teams/") and item[2] == "nba" for item in asked))


class MatchupTests(unittest.TestCase):
    def test_the_matchup_reads_the_nba(self):
        seen = []

        def espn(path, params=None, timeout=15, league="wnba"):
            seen.append(league)
            return espn_day(GAME) if path == "/scoreboard" else {}
        matchup._memory.clear()
        with patch.object(matchup, "espn", side_effect=espn), patch.object(matchup, "_store") as store, \
                patch.object(matchup, "setex"):
            store.return_value.get.return_value = None
            self.assertEqual(matchup.find_event("GS", "LAL", "2026-11-04T03:00:00Z", "nba"), "401")
        self.assertEqual(set(seen), {"nba"})


if __name__ == "__main__":
    unittest.main()


class GamelogBatchTests(unittest.TestCase):
    def ask(self, path):
        request = object.__new__(api.handler)
        request.path, request.headers = path, {}
        sent = []
        with patch.object(api, "_send", side_effect=lambda _, status, payload: sent.append((status, payload))), \
             patch.object(api, "session_with_live_access", return_value=True), \
             patch("site_controls.finder_sport_allowed", return_value=True):
            request.do_GET()
        return sent[0]

    def test_several_players_logs_come_in_one_answer(self):
        def log(player_id):
            if player_id == "2":
                raise RuntimeError("ESPN is down")
            return {"playerId": player_id, "rows": []}
        with patch.object(api, "_nba_gamelog", side_effect=log):
            status, payload = self.ask("/api/wnba?league=nba&resource=gamelogs&playerIds=1,2,3,1&season=2026")
        self.assertEqual(status, 200)
        # One player's failure leaves the others' logs in the answer.
        self.assertEqual(sorted(payload["histories"]), ["1", "2", "3"])
        self.assertEqual(payload["histories"]["1"]["playerId"], "1")
        self.assertIn("error", payload["histories"]["2"])
        with patch.object(api, "_saved_history", side_effect=lambda player_id, league, season: {"rows": [], "season": season, "league": league}):
            status, payload = self.ask("/api/wnba?resource=gamelogs&playerIds=9&season=2026")
        self.assertEqual((status, payload["histories"]["9"]["league"], payload["histories"]["9"]["season"]), (200, "wnba", 2026))

    def test_a_batch_is_capped_and_needs_real_ids(self):
        many = ",".join(str(index) for index in range(api.MAX_GAMELOG_BATCH + 1))
        self.assertEqual(self.ask(f"/api/wnba?league=nba&resource=gamelogs&playerIds={many}")[0], 400)
        self.assertEqual(self.ask("/api/wnba?league=nba&resource=gamelogs&playerIds=1,abc")[0], 400)
        self.assertEqual(self.ask("/api/wnba?resource=gamelogs&playerIds=")[0], 400)


class ResearchDunksTests(unittest.TestCase):
    """A researched player's games the catch-up hasn't reached get their dunks
    counted there and then, and saved for everyone in those games."""

    def summary(self, curry_dunks, plays=True):
        names = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted"]
        athlete = lambda pid, name: {"athlete": {"id": pid, "displayName": name}, "stats": ["30", "20", "8-15", "1-4"]}
        box = {"players": [{"team": {"id": "9", "abbreviation": "GS"}, "statistics": [{"keys": names, "athletes": [athlete("3975", "Stephen Curry"), athlete("77", "Draymond Green")]}]},
                           {"team": {"id": "13", "abbreviation": "LAL"}, "statistics": [{"keys": names, "athletes": [athlete("55", "LeBron James")]}]}]}
        dunk = {"type": {"text": "Driving Dunk Shot"}, "scoringPlay": True, "participants": [{"athlete": {"id": "3975"}}]}
        return {"boxscore": box, "plays": [dunk] * curry_dunks if plays else []}

    def history(self, ask, saved, counted=None, fill=True, plays=True):
        rows = [{"gameId": game_id, "date": f"2026-0{index + 1}-01", "seasonKind": "regular", "values": {"player_points": 20}}
                for index, game_id in enumerate(("401", "402", "403"))]
        rows[0]["values"]["player_dunks"] = 4  # the catch-up got there already
        kv = []

        def commands(*rows_):
            kv.append(rows_[0])
            if rows_[0][0] == "HMGET":
                return [[saved.get(game_id) for game_id in rows_[0][2:]]]
            return [1]
        fetched = []

        def espn(path, params, timeout, league_name):
            fetched.append(params["event"])
            return self.summary(counted.get(params["event"], 0), plays)
        with patch("finder_history_store.commands", side_effect=commands), patch.object(league, "espn", side_effect=espn):
            out = api._with_saved_dunks(rows, "3975", fill=fill)
        return out, kv, fetched

    def test_research_counts_his_missing_games_and_saves_them_for_the_whole_game(self):
        out, kv, fetched = self.history("3975", {"402": '{"3975":2,"77":0}'}, counted={"403": 3})
        self.assertEqual([row["values"].get("player_dunks") for row in out], [4, 2, 3])
        # Only the game nobody had counted is fetched; the saved one is read.
        self.assertEqual(fetched, ["403"])
        saved = [row for row in kv if row[0] == "HSET"][0]
        self.assertEqual(saved[:3], ["HSET", api.DUNKS_KEY, "403"])
        # Every player of the counted teams, a 0 included, for their own pages.
        self.assertEqual(api.json.loads(saved[3]), {"3975": 3, "77": 0, "55": 0})

    def test_the_finders_batch_only_reads_what_research_saved(self):
        out, kv, fetched = self.history("3975", {"403": '{"3975":1}'}, fill=False)
        self.assertEqual([row["values"].get("player_dunks") for row in out], [4, None, 1])
        self.assertEqual((fetched, [row[0] for row in kv]), ([], ["HMGET"]))

    def test_a_game_without_plays_yet_is_left_to_try_again(self):
        out, kv, fetched = self.history("3975", {}, counted={}, plays=False)
        self.assertEqual([row["values"].get("player_dunks") for row in out], [4, None, None])
        self.assertEqual(sorted(fetched), ["402", "403"])
        self.assertFalse([row for row in kv if row[0] == "HSET"])

    def test_only_one_players_page_counts(self):
        request = object.__new__(api.handler)
        request.path, request.headers = "/api/wnba?league=nba&resource=gamelog&playerId=3975", {}
        asked = []
        with patch.object(api, "_send"), patch.object(api, "session_with_live_access", return_value=True), \
                patch("site_controls.finder_sport_allowed", return_value=True), \
                patch.object(api, "_saved_history", side_effect=lambda *args, **kwargs: asked.append(kwargs) or {"rows": []}):
            request.do_GET()
            request.path = "/api/wnba?league=nba&resource=gamelogs&playerIds=3975&season=2026"
            request.do_GET()
        self.assertEqual(asked, [{"fill_dunks": True}, {"fill_dunks": False}])


class TonightTests(unittest.TestCase):
    """Tonight's injury reports for the NBA score's who's-out reads (api/wnba.py _nba_tonight)."""

    def setUp(self):
        api._tonight_memory.update(at=0.0, value=None)

    def tearDown(self):
        api._tonight_memory.update(at=0.0, value=None)

    def test_each_teams_next_game_and_who_is_listed(self):
        now = datetime(2026, 11, 3, 16, tzinfo=timezone.utc)
        side = lambda abbr: {"abbr": abbr, "name": abbr, "logo": None}
        days = {"20261103": [{"id": "401", "start": datetime(2026, 11, 4, 0, tzinfo=timezone.utc), "home": side("GS"), "away": side("LAL")},
                             {"id": "402", "start": datetime(2026, 11, 4, 1, tzinfo=timezone.utc), "home": side("BOS"), "away": side("NY")}],
                "20261104": [{"id": "403", "start": datetime(2026, 11, 5, 0, tzinfo=timezone.utc), "home": side("LAL"), "away": side("PHX")}]}
        reports = {"401": {"injuries": {"GS": [{"id": "3975", "name": "Stephen Curry", "position": "PG", "status": "Out"},
                                               {"id": "1", "name": "A", "position": "F", "status": "Day-To-Day"}]},
                           "odds": {"total": 228.5, "home": {"spread": -6.5}, "away": {"spread": 6.5}}},
                   "402": {"injuries": {}}, "403": {"injuries": {"PHX": []}}}
        with patch.object(api, "_nba_day", side_effect=lambda day: days.get(day, [])), \
                patch.object(matchup, "matchup", side_effect=lambda event_id, league_name: reports[event_id]):
            teams = api._nba_tonight(now)["teams"]
        # LAL's next game is tonight's at GS; a game whose report lists nobody stays unknown.
        self.assertEqual((teams["LAL"]["eventId"], teams["LAL"]["opponent"], teams["LAL"]["injuries"]), ("401", "GS", []))
        self.assertEqual([(item["name"], item["out"]) for item in teams["GS"]["injuries"]], [("Stephen Curry", True), ("A", False)])
        self.assertNotIn("BOS", teams)
        self.assertEqual(teams["PHX"]["injuries"], [])
        # Each side's spread and the game's total, where the game page had them.
        self.assertEqual((teams["GS"]["spread"], teams["LAL"]["spread"], teams["GS"]["total"]), (-6.5, 6.5, 228.5))
        self.assertEqual((teams["PHX"]["spread"], teams["PHX"]["total"]), (None, None))

    def test_the_home_spread_when_espn_gives_the_favorites(self):
        teams = [{"side": "away", "abbr": "BOS"}, {"side": "home", "abbr": "WSH"}]
        pick = lambda spread, details: {"pickcenter": [{"spread": spread, "details": details, "overUnder": 225.5}]}
        self.assertEqual(matchup._odds(pick(-9.5, "BOS -9.5"), teams)["home"]["spread"], 9.5)
        self.assertEqual(matchup._odds(pick(9.5, "BOS -9.5"), teams)["home"]["spread"], 9.5)
        self.assertEqual(matchup._odds(pick(-3.5, "WSH -3.5"), teams)["away"]["spread"], 3.5)


class PropsLogTests(unittest.TestCase):
    """The Props tab's report (api/wnba.py do_POST -> props_record.remember)."""

    def post(self, path, body):
        import io
        request = object.__new__(api.handler)
        raw = json.dumps(body).encode()
        request.path, request.headers, request.rfile = path, {"Content-Length": str(len(raw))}, io.BytesIO(raw)
        sent = []
        with patch.object(api, "_send", side_effect=lambda _, status, payload: sent.append((status, payload))), \
             patch.object(api, "session_with_live_access", return_value=True):
            request.do_POST()
        return sent[0]

    def test_a_report_is_kept(self):
        kept = []
        import props_record
        with patch.object(props_record, "remember", side_effect=lambda rows, pipeline: kept.append(rows) or len(rows)):
            status, payload = self.post("/api/wnba?league=nba&resource=props-log", {"rows": [{"id": "1"}, {"id": "2"}]})
        self.assertEqual((status, payload["kept"]), (200, 2))
        self.assertEqual(kept[0][1]["id"], "2")
        self.assertEqual(self.post("/api/wnba?resource=props-log", {"rows": []})[0], 404)
