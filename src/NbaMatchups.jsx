// The Props tab's NBA side: every NBA prop on PrizePicks tonight with how
// often it has cleared its line lately and how good tonight's opponent is
// for it (nba-matchup-score.js), sortable either way (MatchupList.jsx). A
// row opens that player's matchup page (NbaMatchupPage.jsx).
import React from 'react';
import {MatchupList} from './MatchupList';
import {nba} from './nba-props-data';
import {spreadScores} from './nba-matchup-score';
import {NbaMatchupPage} from './NbaMatchupPage';

const STATS=[['all','All'],['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],
 ['player_points_rebounds','P+R'],['player_points_assists','P+A'],['player_points_rebounds_assists','PRA'],['player_steals','STL'],['player_blocks','BLK']];
const NBA={key:'nba',store:nba,stats:STATS,score:spreadScores,Page:NbaMatchupPage,words:{
 title:'NBA Matchups',blurb:'Every NBA prop tonight, graded on the matchup, how often it has hit lately and how good the line looks.',
 loading:'Loading tonight’s NBA props…',failed:'NBA props couldn’t load',none:'No NBA props posted right now',
 noneText:'PrizePicks posts tonight’s lines through the day. Check back soon.',
 meta:'Matchup: how good tonight is for the over in that stat. Most of all who’s out from both teams’ injury reports (a regular out on his team, above all at his position, hands him minutes and shots; one out on theirs thins their defense), then how much the opponent gives up (the season and their last 10 games), how fast they play and what they allow his position in it. Threes and blocks also count his last three games against them. 50 is an even matchup, 90+ the best few percent, each part counted by how much it predicted overs over the last two seasons. Last 10: how many of his last 10 games went over this line. Prop grade: PropScout’s chance of the over at this line, from his recent games and role with this matchup graded Elite to Fade the way the Analyzer does before tonight’s injury news. A Demon pays more than a regular line, so it needs a lower chance to be worth taking (shown under its grade): a 43% Demon can be Elite. Where PrizePicks posts a stat only as a Demon, its lowest Demon line is the one shown (with PrizePicks’ Demon icon); Goblins never are. Starter or Bench: whether he started his team’s last game (tonight’s lineup comes about half an hour before tip-off).'}};

export function NbaMatchups(){
 return <MatchupList config={NBA}/>;
}
