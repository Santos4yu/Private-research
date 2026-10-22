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
 title:'NBA Matchups',blurb:'Every NBA prop tonight, graded on the matchup and how often it has hit lately.',
 loading:'Loading tonight’s NBA props…',failed:'NBA props couldn’t load',none:'No NBA props posted right now',
 noneText:'PrizePicks posts tonight’s lines through the day. Check back soon.',
 meta:'Matchup: how soft tonight’s opponent is for that stat, from how much they give up, how fast they play and what they allow his position in it. 50 is an even matchup, 90+ the softest few percent, each part counted by how much it predicted overs over the last two seasons. Last 10: how many of his last 10 games went over this line.'}};

export function NbaMatchups(){
 return <MatchupList config={NBA}/>;
}
