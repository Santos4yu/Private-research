"""Server-only Supabase email authentication. Tokens never enter client storage."""
import os
import requests
from http.cookies import SimpleCookie
ACCESS='vortex_account_access'
REFRESH='vortex_account_refresh'
def configured():return bool(os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_ANON_KEY'))
def call(path,body=None,token=None,method=None):
 if not configured():raise RuntimeError('Email accounts are not configured yet')
 url=os.environ['SUPABASE_URL'].rstrip('/')
 if not url.startswith('https://'):raise RuntimeError('Invalid account configuration')
 headers={'apikey':os.environ['SUPABASE_ANON_KEY'],'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 response=requests.request(method or ('POST' if body is not None else 'GET'),url+'/auth/v1/'+path,json=body,headers=headers,timeout=12)
 if not response.ok:raise ValueError('Account request unsuccessful. Check your credentials or email confirmation and try again.')
 return response.json() if response.content else {}
def cookies(headers):
 cookie=SimpleCookie()
 try:cookie.load(headers.get('Cookie',''))
 except Exception:return {}
 return {k:v.value for k,v in cookie.items()}
def identity(headers):
 token=cookies(headers).get(ACCESS)
 if not token:return None
 try:
  user=call('user',token=token)
  if not user.get('id') or not user.get('email_confirmed_at'):return None
  return {'id':user['id'],'username':user.get('email'),'email':user.get('email'),'has_premium':False,'has_tester':False,'account':True}
 except (ValueError,RuntimeError,requests.RequestException):return None
def session_cookies(data):
 access=data.get('access_token');refresh=data.get('refresh_token')
 if not access or not refresh:raise ValueError('Account session unavailable')
 return [f'{ACCESS}={access}; Path=/; Max-Age={int(data.get("expires_in",3600))}; HttpOnly; Secure; SameSite=Strict',f'{REFRESH}={refresh}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict']
def clear_cookies():return [f'{name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' for name in (ACCESS,REFRESH)]


def rate_allowed(headers,email=''):
    """Shared Redis counter; no emails, passwords or raw addresses in keys."""
    import hashlib
    from v2.board import store
    if not store.KV_URL or not store.KV_TOKEN:raise RuntimeError('Account rate protection unavailable')
    address=headers.get('x-forwarded-for','unknown').split(',')[0].strip()
    digest=hashlib.sha256((address+'|'+str(email).strip().lower()).encode()).hexdigest()
    key='krazy_data:account_rate:'+digest
    response=requests.post(store.KV_URL.rstrip('/')+'/pipeline',json=[['INCR',key],['EXPIRE',key,900,'NX']],headers=store._headers(),timeout=store.TIMEOUT)
    response.raise_for_status()
    result=response.json()
    if not isinstance(result,list) or len(result)<2 or not isinstance(result[0].get('result'),int):raise RuntimeError('Account rate protection unavailable')
    return result[0]['result']<=20
