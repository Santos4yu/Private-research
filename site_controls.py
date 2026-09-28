"""Shared operational policy. No sports/model logic lives here."""
import json
import re
from datetime import datetime, timezone
from v2.board import store, admin_auth
SITE_BACKGROUND_PATH_RE=re.compile(r'^/api/v2-admin\?action=site-background&v=\d+$')
KEY='krazy_data:site_controls:v1'
TABS=('research','finder','v2','slate','saved','slip','builder','moneyline','nrfi','community')
# Leagues offered inside the Finder. Kept separate from disabledSports, which
# governs Research's own MLB/NFL switch -- hiding NFL from the Finder must not
# take NFL research away from anyone.
FINDER_SPORTS=('wnba','mlb','nfl')
HEX_COLOR_RE=re.compile(r'^#[0-9a-fA-F]{6}$')
DEFAULT={'maintenance':False,'message':'We are updating Vortex. Please check back shortly.','requireLogin':True,'registrationOpen':True,'disabledTabs':[],'disabledSports':[],'disabledFinderSports':[],'backgroundImage':{'url':'','opacity':35},'theme':{'primary':'','secondary':'','tint':0},'updatedAt':None}
def read():
 raw=store.get(KEY)
 if raw is None:return dict(DEFAULT)
 value=json.loads(raw)
 return {**DEFAULT,**value}
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
 result['updatedAt']=datetime.now(timezone.utc).isoformat()
 return result
RESOURCE_TABS={'players':'research','prediction':'research','game-log-filters':'research','team-insights':'slate','slate':'slate','v2-board':'v2','board':'v2'}
def allowed(headers,tab=None,sport=None):
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 return not policy['maintenance'] and (not tab or tab not in policy['disabledTabs']) and (not sport or sport not in policy.get('disabledSports',[]))
def finder_sport_allowed(headers,sport):
 """Whether a regular user may load `sport` inside the Finder. Admins always
 may. Closed if the site is in maintenance, the Finder tab is off, or that
 one league is off inside it."""
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 return (not policy['maintenance'] and 'finder' not in policy['disabledTabs']
         and sport not in policy.get('disabledFinderSports',[]))
def same_origin(headers):
 from urllib.parse import urlparse
 origin=urlparse(headers.get('Origin',''))
 return origin.scheme in ('http','https') and origin.netloc==headers.get('Host','')
