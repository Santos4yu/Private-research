export function accessGranted(policy) {
  return Boolean(policy && (policy.isAdmin || (!policy.maintenance && (!policy.requireLogin || policy.account))));
}
export function canUseTab(policy,tab) {
  return accessGranted(policy) && (policy.isAdmin || !policy.disabledTabs.includes(tab));
}

export function availableTab(policy,current,tabs=['research','v2','finder','slate','saved','slip','builder','moneyline','nrfi','community']) {
 if(canUseTab(policy,current))return current;
 return tabs.find(tab=>canUseTab(policy,tab))||null;
}

export function canUseSport(policy,sport){return accessGranted(policy)&&(policy.isAdmin||!(policy.disabledSports||[]).includes(sport));}

// Leagues inside the Finder, controlled separately from Research's sport
// switch (canUseSport) so turning NFL off in the Finder leaves NFL research
// alone. Requires the Finder tab itself to be open.
export const FINDER_SPORTS=['wnba','mlb','nfl'];
export function canUseFinderSport(policy,sport){
 return canUseTab(policy,'finder')&&(policy.isAdmin||!(policy.disabledFinderSports||[]).includes(sport));
}
