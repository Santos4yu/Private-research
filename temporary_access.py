"""Owner-requested, reversible public research access during the storage outage.

This is not an admin credential or a member identity. Set ENABLED back to
False and deploy to restore the saved sign-in requirement. Never write this
temporary policy over the database's existing settings.
"""
ENABLED = False
PUBLIC_TABS = ('research', 'finder', 'v2', 'slate', 'saved', 'slip', 'builder', 'nrfi')


def enabled():
    return ENABLED


def apply(policy):
    return {**policy, 'requireLogin': False, 'registrationOpen': False,
            'temporaryPublicAccess': True,
            # Community needs distinct, verified member identities.
            'disabledTabs': sorted(set(policy.get('disabledTabs') or []) | {'community'})}


def outage_policy(default, tabs, finder_sports):
    """Explicit public read-only scope, not a generic fail-open fallback."""
    return apply({**default, 'maintenance': False,
                  'disabledTabs': [tab for tab in tabs if tab not in PUBLIC_TABS],
                  'disabledFinderSports': [], 'finderSportsSeen': list(finder_sports),
                  'tabsSeen': list(tabs), 'storageUnavailable': True})


def visitor():
    return {'id': 'public-visitor', 'username': 'Visitor', 'public': True}
