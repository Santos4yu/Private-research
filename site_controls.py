"""Shared operational policy. No sports/model logic lives here."""
import json
import re
import temporary_access
from datetime import datetime, timezone
from v2.board import store, admin_auth
SITE_BACKGROUND_PATH_RE=re.compile(r'^/api/v2-admin\?action=site-background&v=\d+$')
KEY='krazy_data:site_controls:v1'
TABS=('research','finder','moves','v2','slate','saved','slip','builder','moneyline','nrfi','community','bot','sheets','promos','export','bets')
# The sections settings saved before tabsSeen existed knew of. A section
# added later starts switched off until the admin turns it on, the same way
# new Finder leagues do below -- so a page still being built never appears
# for everyone the moment it deploys.
LEGACY_TABS=('research','finder','v2','slate','saved','slip','builder','moneyline','nrfi','community')
# Sections only an admin session may open. They have no site switch or
# per-member rule (src/site-access-core.js ADMIN_TABS is the page's side).
ADMIN_TABS=('moneyline',)
# Sections that were admin-only and now have a switch like the rest. Every
# saved setting had already "seen" them, so they're kept off for members
# until the admin has saved the settings with their switch showing.
OPENED_TABS=('export',)
# Leagues offered inside the Finder. Kept separate from disabledSports, which
# governs Research's own MLB/NFL switch -- hiding NFL from the Finder must not
# take NFL research away from anyone.
FINDER_SPORTS=('wnba','mlb','nfl','soccer','nhl','nba','tennis','cs2','cfb')
# The Finder leagues settings saved before finderSportsSeen existed knew of.
# A league added later starts switched off until the admin turns it on, so a
# half-built league never appears for everyone the moment it deploys.
# (finderSportsSeen replaced finderSportsKnown, which put soccer back to off
# once while it is still in preview.)
LEGACY_FINDER_SPORTS=('wnba','mlb','nfl')
# Cheat Sheets, one switch each, as "league:sheet" (mlb_sheets.py,
# nfl_sheets.py). MLB's eight came before sheetsSeen, so they stay as they
# were; a sheet added later starts switched off until the admin turns it on.
SHEETS=('mlb:hr','mlb:hot','mlb:matchups','mlb:bvp','mlb:nrfi','mlb:park','mlb:strikeouts','mlb:streaks',
 'nfl:best','nfl:td','nfl:firsttd','nfl:streaks','nfl:zones','nfl:redzone','nfl:speed','nfl:steam','nfl:shop','nfl:dvp','nfl:soft','nfl:goblins',
 'nba:pace','nba:out')
LEGACY_SHEETS=tuple(key for key in SHEETS if key.startswith('mlb:'))
HEX_COLOR_RE=re.compile(r'^#[0-9a-fA-F]{6}$')
# The phone dock: the sections the admin puts in its four slots, in order
# (More is always last). Any section a member can have may go there; one
# switched off for someone is filled from the next in line on their phone
# (src/mobile-nav-core.js dockTabs).
DOCK_TABS=tuple(tab for tab in TABS if tab not in ADMIN_TABS)
DOCK_SIZE=4
DOCK_DEFAULT=['finder','research','v2','saved']
DEFAULT={'maintenance':False,'message':'We are updating PropScout. Please check back shortly.','requireLogin':True,'registrationOpen':True,'paidAccess':False,'disabledTabs':[],'disabledSports':[],'disabledFinderSports':[],'disabledSheets':[],'dockTabs':list(DOCK_DEFAULT),'backgroundImage':{'url':'','opacity':35},'theme':{'primary':'','secondary':'','tint':0},'updatedAt':None}
def read():
 try:
  policy=read_saved()
 except store.StorageUnavailable:
  if not temporary_access.enabled():raise
  return temporary_access.outage_policy(DEFAULT,TABS,FINDER_SPORTS)
 return temporary_access.apply(policy) if temporary_access.enabled() else policy

def read_saved():
 """Unmodified settings for the admin editor; never persist a guest override."""
 raw=store.get(KEY,cache_seconds=10)
 if raw is None and store.STORAGE_BACKEND=='supabase':raise store.StorageUnavailable('storage_migration_pending',60)
 value=json.loads(raw) if raw is not None else {}
 policy={**DEFAULT,**value}
 seen_tabs=value.get('tabsSeen')
 seen_tabs=set(seen_tabs) if isinstance(seen_tabs,list) else set(LEGACY_TABS)
 # An admin-only section has no switch: nothing to start switched off.
 new_tabs=[tab for tab in TABS if tab not in seen_tabs and tab not in ADMIN_TABS]
 opened=value.get('openedTabsSeen')
 opened=set(opened) if isinstance(opened,list) else set()
 new_tabs+=[tab for tab in OPENED_TABS if tab not in opened and tab not in new_tabs]
 if new_tabs:policy['disabledTabs']=sorted(set(policy.get('disabledTabs') or [])|set(new_tabs))
 known=value.get('finderSportsSeen')
 known=set(known) if isinstance(known,list) else set(LEGACY_FINDER_SPORTS)
 unseen=[sport for sport in FINDER_SPORTS if sport not in known]
 if unseen:policy['disabledFinderSports']=sorted(set(policy.get('disabledFinderSports') or [])|set(unseen))
 seen_sheets=value.get('sheetsSeen')
 seen_sheets=set(seen_sheets) if isinstance(seen_sheets,list) else set(LEGACY_SHEETS)
 new_sheets=[key for key in SHEETS if key not in seen_sheets]
 if new_sheets:policy['disabledSheets']=sorted(set(policy.get('disabledSheets') or [])|set(new_sheets))
 return policy
def _valid_background_url(url):
 if not isinstance(url,str):return False
 if url=='':return True
 if SITE_BACKGROUND_PATH_RE.match(url):return True  # our own uploaded-image endpoint
 from urllib.parse import urlparse
 try:
  parsed=urlparse(url)
 except ValueError:
  return False
 return parsed.scheme in ('http','https') and bool(parsed.netloc)
def validate(body):
 if not isinstance(body,dict):raise ValueError('Invalid settings')
 result=dict(DEFAULT)
 for key in ('maintenance','requireLogin','registrationOpen'):
  if not isinstance(body.get(key),bool):raise ValueError('Switches must be true or false')
  result[key]=body[key]
 # Paid access (whop_billing.py) came later, so settings saved before it
 # existed leave it off.
 paid=body.get('paidAccess',False)
 if not isinstance(paid,bool):raise ValueError('Switches must be true or false')
 result['paidAccess']=paid
 message=body.get('message','')
 if not isinstance(message,str) or not 1<=len(message.strip())<=240:raise ValueError('Maintenance message must contain 1–240 characters')
 result['message']=message.strip()
 tabs=body.get('disabledTabs')
 if not isinstance(tabs,list) or any(t not in TABS for t in tabs):raise ValueError('Invalid tab')
 result['disabledTabs']=sorted(set(tabs))
 sports=body.get('disabledSports',[])
 if not isinstance(sports,list) or any(t!='nfl' for t in sports):raise ValueError('Invalid sport')
 result['disabledSports']=sorted(set(sports))
 finder_sports=body.get('disabledFinderSports',[])
 if not isinstance(finder_sports,list) or any(t not in FINDER_SPORTS for t in finder_sports):raise ValueError('Invalid Finder sport')
 result['disabledFinderSports']=sorted(set(finder_sports))
 dock=body.get('dockTabs',DOCK_DEFAULT)
 if not isinstance(dock,list) or not 1<=len(dock)<=DOCK_SIZE or any(t not in DOCK_TABS for t in dock) or len(set(dock))!=len(dock):
  raise ValueError('The dock takes one to four different sections')
 result['dockTabs']=list(dock)
 sheets=body.get('disabledSheets',[])
 if not isinstance(sheets,list) or any(t not in SHEETS for t in sheets):raise ValueError('Invalid cheat sheet')
 result['disabledSheets']=sorted(set(sheets))
 # Every league and sheet the admin saw a switch for is now a deliberate choice.
 result['finderSportsSeen']=list(FINDER_SPORTS)
 result['sheetsSeen']=list(SHEETS)
 result['tabsSeen']=list(TABS)
 result['openedTabsSeen']=list(OPENED_TABS)
 # Site-wide background must be a real http(s) link or our own uploaded-
 # image endpoint (see site_background.py) -- never a raw data: URL, since
 # this whole object is embedded in every visitor's site-status poll
 # response and a large inline image would bloat that payload for everyone.
 bg=body.get('backgroundImage') or {}
 if not isinstance(bg,dict):raise ValueError('Invalid background image settings')
 bg_url=bg.get('url','')
 if not _valid_background_url(bg_url):raise ValueError('Background image must be a valid http(s) link')
 bg_opacity=bg.get('opacity',35)
 if isinstance(bg_opacity,bool) or not isinstance(bg_opacity,(int,float)) or not 5<=bg_opacity<=100:
  raise ValueError('Background image opacity must be between 5 and 100')
 result['backgroundImage']={'url':bg_url.strip(),'opacity':int(round(bg_opacity))}
 # Site-wide color theme: an empty primary means "no override, use the
 # built-in default" -- same shape as the personal accent theme in app.js
 # (primary/secondary hex + a 0-35 background tint), so the admin's choice
 # can be applied with the exact same function on every visitor's device.
 theme=body.get('theme') or {}
 if not isinstance(theme,dict):raise ValueError('Invalid theme settings')
 theme_primary=theme.get('primary','')
 theme_secondary=theme.get('secondary','')
 if theme_primary and not HEX_COLOR_RE.match(theme_primary):raise ValueError('Theme primary color must be a valid hex color')
 if theme_secondary and not HEX_COLOR_RE.match(theme_secondary):raise ValueError('Theme secondary color must be a valid hex color')
 if bool(theme_primary)!=bool(theme_secondary):raise ValueError('Set both theme colors, or neither')
 theme_tint=theme.get('tint',0)
 if isinstance(theme_tint,bool) or not isinstance(theme_tint,(int,float)) or not 0<=theme_tint<=35:
  raise ValueError('Theme tint must be between 0 and 35')
 result['theme']={'primary':theme_primary.lower(),'secondary':theme_secondary.lower(),'tint':int(round(theme_tint))}
 # Colours chosen since a rebrand are marked, so visitors keep them even
 # when they match an earlier brand's default (src/brand-colors.js).
 if theme_primary and theme.get('scout') is True:result['theme']['scout']=True
 if theme_primary and theme.get('ace') is True:result['theme']['ace']=True
 result['updatedAt']=datetime.now(timezone.utc).isoformat()
 return result
RESOURCE_TABS={'players':'research','prediction':'research','game-log-filters':'research','team-insights':'slate','slate':'slate','v2-board':'v2','board':'v2'}
def _items_open(headers,policy,items):
 """Whether every access item is on for whoever sent these headers: the site
 switches, adjusted by that member's own rule (site_members.py). Who is
 asking is only looked up when some member's rule could change the answer."""
 import site_members
 if policy.get('temporaryPublicAccess'):
  return all(site_members.item_open(policy,None,item) for item in items)
 rules=site_members.read_rules()
 rule=None
 if rules and site_members.decides(rules,items):
  from account_auth import identity
  rule=site_members.rule_for(rules,identity(headers))
 if rule and rule.get('suspended'):return False
 return all(site_members.item_open(policy,rule,item) for item in items)
def allowed(headers,tab=None,sport=None):
 if admin_auth.is_admin_request(headers):return True
 if tab in ADMIN_TABS:return False
 policy=read()
 if policy['maintenance']:return False
 return _items_open(headers,policy,[item for item in (tab and f'tab:{tab}',sport and f'sport:{sport}') if item])
def finder_sport_allowed(headers,sport):
 """Whether a regular user may load `sport` inside the Finder. Admins always
 may. Closed if the site is in maintenance, the Finder tab is off, or that
 one league is off inside it -- unless that member has their own access."""
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 if policy['maintenance']:return False
 return _items_open(headers,policy,['tab:finder',f'finderSport:{sport}'])
def sheet_allowed(headers,key):
 """Whether a regular user may open the cheat sheet `key` ("nfl:dvp").
 Admins always may; everyone else needs the Cheat Sheets tab and that sheet
 switched on."""
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 if policy['maintenance'] or key in (policy.get('disabledSheets') or []):return False
 return _items_open(headers,policy,['tab:sheets'])
def finder_sports_allowed(headers):
 """The Finder leagues this viewer may see, all at once (the league
 switches only; the Line Moves page uses it apart from the Finder tab)."""
 if admin_auth.is_admin_request(headers):return list(FINDER_SPORTS)
 policy=read()
 if policy['maintenance']:return []
 return [sport for sport in FINDER_SPORTS if _items_open(headers,policy,[f'finderSport:{sport}'])]
def same_origin(headers):
 from urllib.parse import urlparse
 origin=urlparse(headers.get('Origin',''))
 return origin.scheme in ('http','https') and origin.netloc==headers.get('Host','')
