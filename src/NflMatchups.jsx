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
 title:'NFL Matchups',blurb:'Every NFL prop this week, graded on the matchup.',
 loading:'Loading this week’s NFL props…',failed:'NFL props couldn’t load',none:'No NFL props posted right now',
 noneText:'PrizePicks posts the week’s lines as the games get closer. Check back soon.'}};

export function NflMatchups(){
 return <MatchupList config={NFL}/>;
}
