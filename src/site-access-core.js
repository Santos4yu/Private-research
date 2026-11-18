// A suspended member (site_members.py) is signed in but let into nothing.
// While the site requires a paid subscription (whop_billing.py), a signed-in
// member also needs an active one, or free access from the admin.
export function accessGranted(policy) {
  return Boolean(policy && (policy.isAdmin || (!policy.maintenance && !policy.suspended && (!policy.requireLogin || policy.account) && !needsSubscription(policy))));
}
export function needsSubscription(policy){
  return Boolean(policy&&policy.paidAccess&&policy.account&&!policy.isAdmin&&!policy.comped&&!policy.subscription?.active&&!policy.temporaryPublicAccess);
}
export function accountControlsVisible(policy){
  return accessGranted(policy)&&Boolean(policy.account||policy.isAdmin);
}
// Sections only an admin session ever sees, and members with the Admin
// badge (site_members.py full_access: policy.fullAccess). They have no switch
// in the admin panel.
export const ADMIN_TABS=['moneyline'];
export function canUseTab(policy,tab) {
  return accessGranted(policy) && (policy.isAdmin || policy.fullAccess || (!ADMIN_TABS.includes(tab) && !policy.disabledTabs.includes(tab)));
}

// The sections this viewer should not see at all: the ones switched off in
// the admin panel, for a signed-in non-admin. Empty for an admin, and when
// the site isn't open to this viewer (the whole app is hidden then anyway).
export function hiddenTabs(policy,tabs){
 return accessGranted(policy)?tabs.filter(tab=>!canUseTab(policy,tab)):[];
}

export function availableTab(policy,current,tabs=['finder','research','moves','v2','slate','saved','slip','builder','moneyline','nrfi','community','bot','sheets','promos','export','bets','predictor']) {
 if(canUseTab(policy,current))return current;
 return tabs.find(tab=>canUseTab(policy,tab))||null;
}

export function canUseSport(policy,sport){return accessGranted(policy)&&(policy.isAdmin||!(policy.disabledSports||[]).includes(sport));}

// Leagues inside the Finder, controlled separately from Research's sport
// switch (canUseSport) so turning NFL off in the Finder leaves NFL research
// alone. Requires the Finder tab itself to be open.
export const FINDER_SPORTS=['wnba','mlb','nfl','soccer','nhl','nba','tennis','cs2','cfb'];
export function canUseFinderSport(policy,sport){
 return canUseTab(policy,'finder')&&(policy.isAdmin||!(policy.disabledFinderSports||[]).includes(sport));
}

// Cheat Sheets, one admin switch each (site_controls SHEETS, same keys and
// order). A sheet switched off is hidden from everyone but admins.
export const CHEAT_SHEETS=[
 ['mlb:hr','HR Props'],['mlb:hot','Hot Bats'],['mlb:matchups','Pitcher vs Lineup'],['mlb:bvp','Batter vs Pitcher'],
 ['mlb:nrfi','NRFI / YRFI'],['mlb:park','Ballpark & Weather'],['mlb:strikeouts','Strikeouts'],['mlb:streaks','Streaks'],
 ['nfl:best','Best Matchups'],['nfl:td','TD Scorers'],['nfl:firsttd','First TD'],['nfl:streaks','Prop Streaks'],['nfl:zones','Target Zones'],
 ['nfl:redzone','Red Zone'],['nfl:speed','Speed Edges'],['nfl:steam','Steam Moves'],['nfl:shop','Line Shopping'],
 ['nfl:dvp','Defense vs Position'],['nfl:soft','Soft Spots'],['nfl:goblins','Goblins & Demons'],
 ['nba:pace','Pace-up Games'],['nba:out','Teammate Out'],
];
// Leagues inside the Props tab besides MLB's board (site_controls
// PROPS_LEAGUES), one switch each; hidden from everyone but admins when off.
export const PROPS_LEAGUES=[['nba','NBA matchups'],['nfl','NFL matchups']];
export function canUsePropsLeague(policy,league){
 return canUseTab(policy,'v2')&&(policy.isAdmin||!(policy.disabledPropsLeagues||[]).includes(league));
}
// Research inside the pages (site_controls RESEARCH_SECTIONS), one switch
// each; hidden from everyone but admins when off. New ones start off.
export const RESEARCH_SECTIONS=[['news','Player news on the Finder player page'],['dvp5','NBA Defense vs position: PG / SG / SF / PF / C (depth charts)']];
export function canUseResearch(policy,key){
 return policy.isAdmin||!(policy.disabledResearch||[]).includes(key);
}
export function canUseSheet(policy,key){
 return canUseTab(policy,'sheets')&&(policy.isAdmin||!(policy.disabledSheets||[]).includes(key));
}
