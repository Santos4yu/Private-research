export function accessGranted(policy) {
  return Boolean(policy && (policy.isAdmin || (!policy.maintenance && (!policy.requireLogin || policy.account))));
}
export function canUseTab(policy,tab) {
  return accessGranted(policy) && (policy.isAdmin || !policy.disabledTabs.includes(tab));
}
