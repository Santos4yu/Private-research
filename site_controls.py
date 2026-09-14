"""Shared operational policy. No sports/model logic lives here."""
import json
from datetime import datetime, timezone
from v2.board import store, admin_auth
KEY='krazy_data:site_controls:v1'
TABS=('research','v2','slate','saved','slip','builder','moneyline','nrfi')
DEFAULT={'maintenance':False,'message':'We are updating Vortex. Please check back shortly.','requireLogin':True,'registrationOpen':True,'disabledTabs':[],'disabledSports':[],'backgroundImage':{'url':'','opacity':35},'updatedAt':None}
def read():
 raw=store.get(KEY)
 if raw is None:return dict(DEFAULT)
 value=json.loads(raw)
 return {**DEFAULT,**value}
def _valid_background_url(url):
 if not isinstance(url,str):return False
 if url=='':return True
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
 # Site-wide background must be a real hosted link, not an uploaded data:
 # URL -- this gets embedded in every visitor's site-status poll response,
 # so a large inline image would bloat that payload for everyone.
 bg=body.get('backgroundImage') or {}
 if not isinstance(bg,dict):raise ValueError('Invalid background image settings')
 bg_url=bg.get('url','')
 if not _valid_background_url(bg_url):raise ValueError('Background image must be a valid http(s) link')
 bg_opacity=bg.get('opacity',35)
 if isinstance(bg_opacity,bool) or not isinstance(bg_opacity,(int,float)) or not 5<=bg_opacity<=100:
  raise ValueError('Background image opacity must be between 5 and 100')
 result['backgroundImage']={'url':bg_url.strip(),'opacity':int(round(bg_opacity))}
 result['updatedAt']=datetime.now(timezone.utc).isoformat()
 return result
RESOURCE_TABS={'players':'research','prediction':'research','game-log-filters':'research','team-insights':'slate','slate':'slate','v2-board':'v2','board':'v2'}
def allowed(headers,tab=None,sport=None):
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 return not policy['maintenance'] and (not tab or tab not in policy['disabledTabs']) and (not sport or sport not in policy.get('disabledSports',[]))
def same_origin(headers):
 from urllib.parse import urlparse
 origin=urlparse(headers.get('Origin',''))
 return origin.scheme in ('http','https') and origin.netloc==headers.get('Host','')
