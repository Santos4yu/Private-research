import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import nba_matchups
import nba_relay as relay
from backend.sports.wnba import tracking

NOW = datetime(2026, 10, 21, 16, tzinfo=timezone.utc).timestamp()


class FakeKV:
    """The KV commands nba_relay uses, in memory."""

    def __init__(self):
        self.data = {}

    def __call__(self, commands, timeout=None):
        return [self.run(*command) for command in commands]

    def run(self, name, key, *args):
        if name == 'GET':
            return self.data.get(key)
        if name == 'SET':
            if 'NX' in args and key in self.data:
                return None
            self.data[key] = args[0]
            return 'OK'
        if name == 'HSET':
            table = self.data.setdefault(key, {})
            for field, value in zip(args[0::2], args[1::2]):
                table[field] = value
            return len(args) // 2
        if name == 'HGETALL':
            return [item for pair in self.data.get(key, {}).items() for item in pair]
        if name == 'EXPIRE':
            return 1
        if name == 'DEL':
            return int(self.data.pop(key, None) is not None)
        raise AssertionError(name)


def answer(resource, parameters, headers, rows):
    return {'resource': resource, 'parameters': parameters, 'resultSets': [{'name': 'Table', 'headers': headers, 'rowSet': rows}]}


MATCHUP_HEADERS = ['SEASON_ID', 'OFF_PLAYER_ID', 'OFF_PLAYER_NAME', 'DEF_PLAYER_ID', 'DEF_PLAYER_NAME', 'GP', 'MATCHUP_MIN',
                   'PARTIAL_POSS', 'PLAYER_PTS']


def matchups(team, rows, season='2025-26'):
    return answer('leagueseasonmatchups', {'LeagueID': '00', 'Season': season, 'SeasonType': 'Regular Season',
                                           'PerMode': 'Totals', 'OffTeamID': int(team), 'OffPlayerID': None},
                  MATCHUP_HEADERS, rows)


class Base(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()
        relay._memory.clear()
        # Tables read here mustn't be served to other tests from memory.
        self.addCleanup(relay._memory.clear)
        patcher = patch.object(relay, '_pipeline', self.kv)
        patcher.start()
        self.addCleanup(patcher.stop)


class JobsTests(Base):
    def test_last_season_first_then_this_seasons_and_only_what_is_due(self):
        first = relay.jobs(NOW)
        self.assertEqual(len(first), relay.MAX_JOBS)
        self.assertIn('Season=2025-26', first[0])
        self.assertTrue(all(link.startswith('https://stats.nba.com/stats/') for link in first))
        self.assertNotIn(' ', ''.join(first))
        for job in relay.tables(2026):
            self.kv.data.setdefault(relay.SENT_KEY, {})[relay.fingerprint(*job)] = str(int(NOW))
        due = relay.jobs(NOW)
        self.assertEqual(len(due), len(relay.tables(2027)))
        self.assertTrue(all('2026-27' in link for link in due))
        for job in relay.tables(2027):
            self.kv.data[relay.SENT_KEY][relay.fingerprint(*job)] = str(int(NOW))
        self.assertEqual(relay.jobs(NOW + 3600), [])
        # A day on, this season's come round again; last season's never do.
        self.assertEqual(len(relay.jobs(NOW + relay.FRESH_SECONDS)), len(relay.tables(2027)))


class AcceptTests(Base):
    def test_season_matchups_are_kept_by_player_across_teams(self):
        relay.accept(matchups('1610612754', [['22025', 101, 'A Guard', 9, 'Nembhard', 3, '12:10', 40.5, 22],
                                             ['22025', 102, 'B Wing', 9, 'Nembhard', 1, '2:00', 6.0, 2]]), now=NOW)
        relay.accept(matchups('1610612740', [['22025', 101, 'A Guard', 7, 'Murray', 2, '8:00', 20.0, 9]]), now=NOW)
        found = relay.rows('leagueseasonmatchups', {'LeagueID': '00', 'Season': '2025-26', 'SeasonType': 'Regular Season',
                                                    'PerMode': 'Totals', 'OffPlayerID': '101'})
        self.assertEqual(sorted(row['DEF_PLAYER_NAME'] for row in found), ['Murray', 'Nembhard'])
        # Sent, and nothing for him: an empty answer, not "ask NBA.com".
        self.assertEqual(relay.rows('leagueseasonmatchups', {'Season': '2025-26', 'OffPlayerID': '999'}), [])
        self.assertIsNone(relay.rows('leagueseasonmatchups', {'Season': '2026-27', 'OffPlayerID': '101'}))
        # Once the phone has sent anything for this season, no matchups is an answer.
        relay.accept(answer('commonallplayers', {'Season': '2026-27'}, ['PERSON_ID'], [[101]]), now=NOW)
        relay._memory.clear()
        self.assertEqual(relay.rows('leagueseasonmatchups', {'Season': '2026-27', 'OffPlayerID': '101'}), [])

    def test_other_tables_come_back_as_nba_com_rows(self):
        params = tracking._params('Passing', 2026, 0)
        relay.accept(answer('leaguedashptstats', {**params, 'LastNGames': 0}, ['PLAYER_ID', 'PLAYER_NAME', 'POTENTIAL_AST'],
                            [[1, 'Jeremiah Fears', 7.1]]), now=NOW)
        self.assertEqual(relay.rows('leaguedashptstats', params), [{'PLAYER_ID': 1, 'PLAYER_NAME': 'Jeremiah Fears', 'POTENTIAL_AST': 7.1}])
        self.assertIsNone(relay.rows('leaguedashptstats', tracking._params('Rebounding', 2026, 0)))
        self.assertEqual(relay.status(NOW)['last'], int(NOW))

    def test_a_table_taken_clears_the_last_turned_away_note(self):
        relay.note_problem('Not a table the site asks for (unnamed).')
        self.assertTrue(relay.status(NOW)['problem'])
        relay.accept(answer('commonallplayers', {'Season': '2026-27'}, ['PERSON_ID'], [[1]]), now=NOW)
        self.assertIsNone(relay.status(NOW)['problem'])

    def test_season_matchups_whose_team_nba_com_leaves_out_are_told_by_their_players(self):
        relay.accept(answer('commonallplayers', {'LeagueID': '00', 'Season': '2025-26', 'IsOnlyCurrentSeason': 1},
                            ['PERSON_ID', 'DISPLAY_FIRST_LAST', 'TEAM_ID'], [[101, 'A Guard', 1610612754], [102, 'B Wing', 1610612754]]), now=NOW)
        payload = matchups('1610612754', [['22025', 101, 'A Guard', 9, 'Nembhard', 3, '12:10', 40.5, 22],
                                          ['22025', 102, 'B Wing', 9, 'Nembhard', 1, '2:00', 6.0, 2]])
        # Echoed without the team, and without the season too.
        payload['parameters'] = {'OffPlayerID': None, 'DefPlayerID': None, 'DefTeamID': None, 'SeasonType': 'Regular Season',
                                 'LeagueID': '00', 'PORound': None}
        self.assertEqual(relay.accept(payload, now=NOW)['table'], 'leagueseasonmatchups|season=2025-26|offteamid=1610612754')
        found = relay.rows('leagueseasonmatchups', {'Season': '2025-26', 'OffPlayerID': '101'})
        self.assertEqual(found[0]['DEF_PLAYER_NAME'], 'Nembhard')

    def test_play_types_come_back_named_in_the_singular(self):
        params = {'LeagueID': '00', 'SeasonYear': '2025-26', 'SeasonType': 'Regular Season', 'PerMode': 'PerGame',
                  'PlayType': 'Misc', 'PlayerOrTeam': 'T', 'TypeGrouping': 'defensive'}
        relay.accept(answer('synergyplaytype', params, ['TEAM_ID', 'PPP'], [[1610612754, 0.98]]), now=NOW)
        self.assertEqual(relay.rows('synergyplaytypes', params), [{'TEAM_ID': 1610612754, 'PPP': 0.98}])
        self.assertEqual(relay.status(NOW)['past'], 1)

    def test_tracking_tables_are_told_by_their_columns_and_games(self):
        columns = ['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GP', 'MIN', *tracking.MEASURES['Passing']]
        echoed = {'Season': '2025-26', 'PlayerOrTeam': 'Player', 'LastNGames': None, 'PtMeasureType': None}
        # A whole season: players with more than ten games.
        whole = relay.accept(answer('leaguedashptstats', echoed, columns, [[1, 'A', 'NOP', 82, 30.0, *[1.0] * 6]]), now=NOW)
        self.assertEqual(whole['table'], relay.fingerprint('leaguedashptstats', tracking._params('Passing', 2026, 0)))
        # Ten games or fewer: the season so far and the last ten are the same table.
        early = relay.accept(answer('leaguedashptstats', {**echoed, 'Season': '2026-27'}, columns,
                                    [[1, 'A', 'NOP', 1, 30.0, *[2.0] * 6]]), now=NOW)
        self.assertEqual(len(early['table']), 2)
        for last in (0, tracking.RECENT):
            self.assertEqual(relay.rows('leaguedashptstats', tracking._params('Passing', 2027, last))[0]['POTENTIAL_AST'], 2.0)

    def test_a_last_ten_table_never_overwrites_its_season(self):
        columns = ['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GP', 'MIN', *tracking.MEASURES['Passing']]
        echoed = {'Season': '2025-26', 'PlayerOrTeam': 'Player', 'LastNGames': None, 'PtMeasureType': None}
        relay.accept(answer('leaguedashptstats', echoed, columns, [[1, 'A', 'NOP', 82, 30.0, *[1.0] * 6]]), now=NOW)
        # Last season is over: ten games or fewer is its last ten, only.
        done = relay.accept(answer('leaguedashptstats', echoed, columns, [[1, 'A', 'NOP', 10, 30.0, *[3.0] * 6]]), now=NOW)
        self.assertEqual(done['table'], relay.fingerprint('leaguedashptstats', tracking._params('Passing', 2026, tracking.RECENT)))
        self.assertEqual(relay.rows('leaguedashptstats', tracking._params('Passing', 2026, 0))[0]['GP'], 82)
        # This season, once its whole-season table has more than ten games.
        now_echoed = {**echoed, 'Season': '2026-27'}
        relay.accept(answer('leaguedashptstats', now_echoed, columns, [[1, 'A', 'NOP', 14, 30.0, *[1.0] * 6]]), now=NOW)
        later = relay.accept(answer('leaguedashptstats', now_echoed, columns, [[1, 'A', 'NOP', 10, 30.0, *[3.0] * 6]]), now=NOW)
        self.assertEqual(later['table'], relay.fingerprint('leaguedashptstats', tracking._params('Passing', 2027, tracking.RECENT)))
        self.assertEqual(relay.rows('leaguedashptstats', tracking._params('Passing', 2027, 0))[0]['GP'], 14)

    def test_damaged_copies_are_asked_for_again(self):
        damaged = 'leaguedashptstats|season=2025-26|ptmeasuretype=passing|lastngames=0'
        self.kv.data[relay.SENT_KEY] = {damaged: str(relay.REDO[damaged] - 60)}
        self.assertTrue(any('PtMeasureType=Passing' in link and 'Season=2025-26' in link and 'LastNGames=0' in link
                            for link in relay.jobs(NOW)))
        self.kv.data[relay.SENT_KEY] = {damaged: str(relay.REDO[damaged] + 60)}
        self.assertFalse(any('PtMeasureType=Passing' in link and 'Season=2025-26' in link and 'LastNGames=0' in link
                             for link in relay.jobs(NOW)))

    def test_parameters_listed_one_per_entry_are_read_too(self):
        payload = answer('commonallplayers', [{'LeagueID': '00'}, {'Season': '2026-27'}, {'IsOnlyCurrentSeason': 1}],
                         ['PERSON_ID', 'DISPLAY_FIRST_LAST'], [[1, 'Jeremiah Fears']])
        self.assertEqual(relay.accept(payload, now=NOW)['rows'], 1)

    def test_anything_else_is_turned_away(self):
        for payload in ([], {'resource': 'leaguegamelog', 'parameters': {}, 'resultSets': []},
                        answer('commonallplayers', {'Season': '2019-20'}, ['PERSON_ID'], [[1]]),
                        answer('commonallplayers', {'Season': '2026-27'}, ['PERSON_ID', 'NAME'], [[1]])):
            with self.assertRaises(relay.Rejected):
                relay.accept(payload, now=NOW)
        self.assertEqual(self.kv.data, {})


class ReadersTests(Base):
    def test_the_defender_card_reads_what_the_phone_sent(self):
        relay.accept(matchups('1610612754', [['22025', 101, 'A Guard', 9, 'Nembhard', 3, '12:10', 40.5, 22]]), now=NOW)
        with patch.object(nba_matchups.requests, 'get', side_effect=AssertionError('NBA.com asked')):
            rows = nba_matchups._rows('leagueseasonmatchups', {'LeagueID': '00', 'Season': '2025-26', 'SeasonType': 'Regular Season',
                                                               'PerMode': 'Totals', 'OffPlayerID': '101'})
        self.assertEqual(rows[0]['DEF_PLAYER_NAME'], 'Nembhard')

    def test_tracking_builds_from_the_phones_tables_while_nba_com_is_down(self):
        jobs = [(measure, 2026, 0) for measure in tracking.MEASURES] + [(measure, 2026, tracking.RECENT) for measure in tracking.RECENT_MEASURES]
        for measure, season, last in jobs:
            columns = ['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GP', 'MIN', *tracking.MEASURES[measure]]
            relay.accept(answer('leaguedashptstats', tracking._params(measure, season, last), columns,
                                [[1, 'Jeremiah Fears', 'NOP', 82, 27.9, *[1.0] * len(tracking.MEASURES[measure])]]), now=NOW)
        built = tracking.build(2026, get=tracking._refuse)
        entry = tracking.find(built, 'Jeremiah Fears', 'NO')
        self.assertEqual(entry['passing']['potentialAst'], 1.0)
        self.assertEqual(entry['recent']['games'], 82)


if __name__ == '__main__':
    unittest.main()
