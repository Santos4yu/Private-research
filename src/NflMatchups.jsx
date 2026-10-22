// The Props tab's NFL side: every NFL prop on PrizePicks this week with how
// often it has cleared its line lately and how good this week's defense is
// for it (nfl-matchup-score.js), sortable either way (MatchupList.jsx). A
// row opens that player's matchup page (NflMatchupPage.jsx).
import React from 'react';
import {MatchupList} from './MatchupList';
import {nfl} from './nfl-props-data';
import {spreadScores} from './nfl-matchup-score';
import {NFL_STATS,NflMatchupPage} from './NflMatchupPage';

const NFL={key:'nfl',store:nfl,stats:NFL_STATS,score:spreadScores,Page:NflMatchupPage,words:{
 title:'NFL Matchups',blurb:'Every NFL prop this week, graded on the matchup and how often it has hit lately.',
 loading:'Loading this week’s NFL props…',failed:'NFL props couldn’t load',none:'No NFL props posted right now',
 noneText:'PrizePicks posts the week’s lines as the games get closer. Check back soon.',
 meta:'Matchup: how good this game is for the over in that stat, from what the defense allows, the game’s line (the spread and the points his team is expected to score) and his share of the targets or carries, each counted by how well it predicted players beating their own average in 2024 and 2025. 50 is an even matchup; 90 or more is rare (about the top 2-3%). Last 10: how many of his last 10 games went over this line.'}};

export function NflMatchups(){
 return <MatchupList config={NFL}/>;
}
