// Each Cheat Sheet's #1 on the hub (src/sheet-teasers.js): picked from the
// same data the sheet shows, with the number formatted for its kind.
import test from 'node:test';
import assert from 'node:assert/strict';
import {teaser, teaserValue} from '../src/sheet-teasers.js';

test('MLB HR Props: the top power score, with who he faces', () => {
  const pick = teaser('mlb', 'hr', {rows: [
    {id: 1, name: 'Kike Hernandez', team: 'CLE', opponent: 'DET', pitcher: {name: 'Will Smith'}, score: 74},
    {id: 2, name: 'Trent Grisham', team: 'ATL', opponent: 'DET', pitcher: {name: 'Tarik Skubal'}, score: 79},
    {id: 3, name: 'No Score', team: 'TB', opponent: 'NYY', score: null},
  ]});
  assert.deepEqual(pick, {name: 'Trent Grisham', id: 2, detail: 'ATL vs Skubal', value: 79, kind: 'score'});
  assert.equal(teaserValue(pick), '79');
});

test('MLB Pitcher vs Lineup: the best bat across every lineup', () => {
  const pick = teaser('mlb', 'matchups', {games: [
    {halves: [
      {team: 'ATL', pitcher: {name: 'Tarik Skubal'}, lineup: [{id: 1, name: 'A', score: 60}]},
      {team: 'DET', pitcher: null, lineup: [{id: 2, name: 'B', score: 81}]},
    ]},
  ]});
  assert.equal(pick.name, 'B');
  assert.equal(pick.detail, 'DET vs TBD', 'no probable starter yet');
});

test('MLB NRFI, Ballpark and Streaks read their own numbers', () => {
  const nrfi = teaser('mlb', 'nrfi', {rows: [
    {away: {team: 'CWS'}, home: {team: 'CLE'}, chance: 0.58},
    {away: {team: 'SD'}, home: {team: 'MIL'}, chance: 0.66},
  ]});
  assert.equal(nrfi.name, 'SD @ MIL');
  assert.equal(teaserValue(nrfi), '66%');

  const park = teaser('mlb', 'park', {rows: [{venue: 'Coors Field', away: 'SD', home: 'COL', runs: 18.4}]});
  assert.equal(park.detail, 'SD @ COL · runs +18%');
  assert.equal(teaserValue(park), '+18%');
  assert.equal(teaserValue({value: -7.6, kind: 'signed'}), '−8%');

  const streak = teaser('mlb', 'streaks', {streaks: {hits: {rows: [{id: 9, name: 'C', team: 'LAD', streak: 14}]}}});
  assert.equal(streak.detail, 'LAD · hit in 14 straight');
  assert.equal(teaserValue(streak), '14');
});

test('NFL sheets: chance, edge and rank read the way the sheet shows them', () => {
  const td = teaser('nfl', 'td', {players: [
    {who: {name: 'Bijan Robinson', position: 'RB', team: 'ATL', headshot: 'b.png'}, opponent: 'TB', chance: 0.52},
    {who: {name: 'Drake London', position: 'WR', team: 'ATL'}, opponent: 'TB', chance: 0.38},
  ]});
  assert.deepEqual(td, {name: 'Bijan Robinson', photo: 'b.png', detail: 'RB · ATL vs TB', value: 0.52, kind: 'pct'});
  assert.equal(teaserValue(td), '52%');

  const top = teaser('nfl', 'best', {rows: [
    {who: {name: 'Cam Skattebo', headshot: null}, line: 50.5, label: 'Rush Yards', opponent: 'PHI', score: 83},
    {who: {name: 'Josh Allen'}, line: 231.5, label: 'Pass Yards', opponent: 'NE', score: 61},
  ]});
  assert.deepEqual(top, {name: 'Cam Skattebo', photo: null, detail: 'More 50.5 Rush Yards vs PHI', value: 83, kind: 'score'});

  const shop = teaser('nfl', 'shop', {rows: [
    {who: {name: 'Puka Nacua'}, side: 'over', line: 6.5, label: 'Receptions', bookName: 'FanDuel', edge: 0.061},
  ]});
  assert.equal(shop.detail, 'Over 6.5 Receptions · FanDuel');
  assert.equal(teaserValue(shop), '+6%');

  const dvp = teaser('nfl', 'dvp', {softest: [{team: 'HOU', position: 'WR', opponent: 'TEN', rank: 32}]});
  assert.equal(dvp.name, 'HOU vs WRs');
  assert.equal(teaserValue(dvp), '#32');

  const soft = teaser('nfl', 'soft', {spots: [{who: {name: 'D'}, label: 'Rush Yds', rank: 32, teams: 32}]});
  assert.equal(soft.detail, 'Rush Yds vs the softest defense');
});

test('nothing to show reads as no pick, never a crash', () => {
  assert.equal(teaser('mlb', 'hr', {rows: []}), null);
  assert.equal(teaser('mlb', 'hr', null), null);
  assert.equal(teaser('nfl', 'firsttd', {}), null);
  assert.equal(teaser('nba', 'hr', {rows: [{score: 1}]}), null, 'a league with no sheets');
  assert.equal(teaser('mlb', 'nope', {rows: [{score: 1}]}), null);
  assert.equal(teaserValue({value: null, kind: 'pct'}), '—');
  assert.equal(teaserValue(), '—');
});

test('NBA Pace-up Games and Teammate Out', () => {
  const pace = teaser('nba', 'pace', {rows: [{away: 'ATL', home: 'IND', projected: 104.24, paceUp: true, score: 79}, {away: 'NY', home: 'MIA', projected: 96, score: 20}]});
  assert.deepEqual(pace, {name: 'ATL @ IND', photo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png', detail: '104.2 possessions · two fast teams', value: 79, kind: 'score'});
  const out = teaser('nba', 'out', {rows: [
    {who: {name: 'Bennedict Mathurin', headshot: 'h.png'}, out: {name: 'Tyrese Haliburton'}, diff: {pts: 6.2}, games: 4, score: 70},
    {who: {name: 'Other Guy'}, out: {name: 'X Y'}, diff: {pts: 1}, games: 2, score: 55}]});
  assert.deepEqual(out, {name: 'Bennedict Mathurin', photo: 'h.png', detail: 'Without Haliburton: +6.2 pts in 4 games', value: 70, kind: 'score'});
  assert.equal(teaser('nba', 'out', {rows: []}), null);
});
