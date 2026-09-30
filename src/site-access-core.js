// A suspended member (site_members.py) is signed in but let into nothing.
export function accessGranted(policy) {
  return Boolean(policy && (policy.isAdmin || (!policy.maintenance && !policy.suspended && (!policy.requireLogin || policy.account))));
}
// Sections only an admin session ever sees. They have no switch in the
// admin panel and no per-member rule: nobody else can be let in.
export const ADMIN_TABS=['moneyline'];
export function canUseTab(policy,tab) {
  return accessGranted(policy) && (policy.isAdmin || (!ADMIN_TABS.includes(tab) && !policy.disabledTabs.includes(tab)));
}

// The sections this viewer should not see at all: the ones switched off in
// the admin panel, for a signed-in non-admin. Empty for an admin, and when
// the site isn't open to this viewer (the whole app is hidden then anyway).
export function hiddenTabs(policy,tabs){
 return accessGranted(policy)?tabs.filter(tab=>!canUseTab(policy,tab)):[];
}

export function availableTab(policy,current,tabs=['finder','research','moves','v2','slate','saved','slip','builder','moneyline','nrfi','community']) {
 if(canUseTab(policy,current))return current;
 return tabs.find(tab=>canUseTab(policy,tab))||null;
}

export function canUseSport(policy,sport){return accessGranted(policy)&&(policy.isAdmin||!(policy.disabledSports||[]).includes(sport));}

// Leagues inside the Finder, controlled separately from Research's sport
// switch (canUseSport) so turning NFL off in the Finder leaves NFL research
// alone. Requires the Finder tab itself to be open.
export const FINDER_SPORTS=['wnba','mlb','nfl','soccer','nhl'];
export function canUseFinderSport(policy,sport){
 return canUseTab(policy,'finder')&&(policy.isAdmin||!(policy.disabledFinderSports||[]).includes(sport));
}
