"""Shared operational policy. No sports/model logic lives here."""
import json
from datetime import datetime, timezone
from v2.board import store, admin_auth
KEY='krazy_data:site_controls:v1'
TABS=('research','v2','slate','saved','slip','builder','moneyline','nrfi')
DEFAULT={'maintenance':False,'message':'We are updating Vortex. Please check back shortly.','requireLogin':True,'registrationOpen':True,'disabledTabs':[],'updatedAt':None}
def read():
 raw=store.get(KEY)
 if raw is None:return dict(DEFAULT)
 value=json.loads(raw)
 return {**DEFAULT,**value}
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
 result['updatedAt']=datetime.now(timezone.utc).isoformat()
 return result
RESOURCE_TABS={'players':'research','prediction':'research','game-log-filters':'research','team-insights':'slate','slate':'slate','v2-board':'v2','board':'v2'}
def allowed(headers,tab=None):
 if admin_auth.is_admin_request(headers):return True
 policy=read()
 return not policy['maintenance'] and (not tab or tab not in policy['disabledTabs'])
def same_origin(headers):
 from urllib.parse import urlparse
 origin=urlparse(headers.get('Origin',''))
 return origin.scheme in ('http','https') and origin.netloc==headers.get('Host','')
