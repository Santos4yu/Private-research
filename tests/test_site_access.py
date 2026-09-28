import unittest
from unittest.mock import patch
from types import SimpleNamespace
import site_controls as controls
import account_auth as accounts
import auth_core
# account_auth caches verifications and refresh rotations in KV, and
# v2/board/store.py loads the REAL Upstash credentials from Vortex/.env. An
# earlier run of these tests wrote a fake verified identity into production
# KV that way. Nothing in this module may reach that store again: every test
# runs with it switched off, and the tests that need it get an in-memory one.
_kv_off=patch.object(accounts,'_kv',return_value=None)
def setUpModule():_kv_off.start()
def tearDownModule():_kv_off.stop()
class SiteControlsTests(unittest.TestCase):
 def test_default_requires_login(self):
  with patch.object(controls.store,'get',return_value=None):self.assertTrue(controls.read()['requireLogin'])
 def test_validate_boolean_tabs_and_message(self):
  for value in ({**controls.DEFAULT,'maintenance':'false'},{**controls.DEFAULT,'disabledTabs':['admin']},{**controls.DEFAULT,'message':''}):
   with self.assertRaises(ValueError):controls.validate(value)
 def test_maintenance_and_disabled_props_enforced_admin_bypasses(self):
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'disabledTabs':['v2']}),patch.object(controls.admin_auth,'is_admin_request',return_value=False):
   self.assertFalse(controls.allowed({},'v2'));self.assertTrue(controls.allowed({},'research'))
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'maintenance':True}),patch.object(controls.admin_auth,'is_admin_request',return_value=True):self.assertTrue(controls.allowed({},'v2'))
 def test_hidden_nfl_blocks_data_and_admin_can_preview(self):
  policy={**controls.DEFAULT,'disabledSports':['nfl']}
  with patch.object(controls,'read',return_value=policy),patch.object(controls.admin_auth,'is_admin_request',return_value=False):
   self.assertFalse(controls.allowed({},'research',sport='nfl'));self.assertTrue(controls.allowed({},'research'))
  with patch.object(controls,'read',return_value=policy),patch.object(controls.admin_auth,'is_admin_request',return_value=True):self.assertTrue(controls.allowed({},'research',sport='nfl'))
 def test_sport_settings_validated_and_old_settings_compatible(self):
  self.assertEqual(controls.validate({**controls.DEFAULT,'disabledSports':['nfl']})['disabledSports'],['nfl'])
  with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'disabledSports':['unknown']})
 def test_a_new_finder_league_starts_off_until_the_admin_saves_it_on(self):
  import json
  # Settings saved before soccer existed: soccer is off, the rest unchanged.
  old={**controls.DEFAULT,'disabledFinderSports':['nfl']}
  old.pop('finderSportsKnown',None)
  with patch.object(controls.store,'get',return_value=json.dumps(old)):
   self.assertEqual(controls.read()['disabledFinderSports'],['nfl','soccer'])
  # The admin then saves with soccer switched on: it stays on.
  saved=controls.validate({**controls.DEFAULT,'disabledFinderSports':['nfl']})
  self.assertEqual(saved['finderSportsKnown'],list(controls.FINDER_SPORTS))
  with patch.object(controls.store,'get',return_value=json.dumps(saved)):
   self.assertEqual(controls.read()['disabledFinderSports'],['nfl'])
  with patch.object(controls.store,'get',return_value=None):
   self.assertIn('soccer',controls.read()['disabledFinderSports'])
 def test_background_image_defaults_when_omitted(self):
  body={k:v for k,v in controls.DEFAULT.items() if k!='backgroundImage'}
  self.assertEqual(controls.validate(body)['backgroundImage'],{'url':'','opacity':35})
 def test_background_image_accepts_valid_link_and_rounds_opacity(self):
  result=controls.validate({**controls.DEFAULT,'backgroundImage':{'url':'https://example.com/a.jpg','opacity':62.6}})
  self.assertEqual(result['backgroundImage'],{'url':'https://example.com/a.jpg','opacity':63})
 def test_background_image_rejects_non_http_and_data_urls(self):
  for url in ('javascript:alert(1)','data:image/png;base64,AAAA','ftp://example.com/a.jpg','not a url'):
   with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'backgroundImage':{'url':url,'opacity':35}})
 def test_background_image_rejects_opacity_out_of_range_or_wrong_type(self):
  for opacity in (0,4,101,'50',True,None):
   with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'backgroundImage':{'url':'','opacity':opacity}})
 def test_background_image_accepts_own_uploaded_image_endpoint(self):
  result=controls.validate({**controls.DEFAULT,'backgroundImage':{'url':'/api/v2-admin?action=site-background&v=1234567890','opacity':40}})
  self.assertEqual(result['backgroundImage']['url'],'/api/v2-admin?action=site-background&v=1234567890')
 def test_background_image_rejects_lookalike_or_traversal_paths(self):
  for url in ('/api/v2-admin?action=site-background','/api/v2-admin?action=site-background&v=abc','/api/other?action=site-background&v=1','//evil.com/api/v2-admin?action=site-background&v=1'):
   with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'backgroundImage':{'url':url,'opacity':35}})
 def test_theme_defaults_to_no_override_when_omitted(self):
  body={k:v for k,v in controls.DEFAULT.items() if k!='theme'}
  self.assertEqual(controls.validate(body)['theme'],{'primary':'','secondary':'','tint':0})
 def test_theme_accepts_valid_colors_and_lowercases_hex(self):
  result=controls.validate({**controls.DEFAULT,'theme':{'primary':'#0082FE','secondary':'#D6E1EA','tint':12.6}})
  self.assertEqual(result['theme'],{'primary':'#0082fe','secondary':'#d6e1ea','tint':13})
 def test_theme_rejects_invalid_hex_colors(self):
  for primary in ('not-a-color','#fff','#gggggg','red','#0082fe;'):
   with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'theme':{'primary':primary,'secondary':'#d6e1ea','tint':0}})
 def test_theme_requires_both_colors_or_neither(self):
  with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'theme':{'primary':'#0082fe','secondary':'','tint':0}})
  with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'theme':{'primary':'','secondary':'#d6e1ea','tint':0}})
 def test_theme_rejects_tint_out_of_range_or_wrong_type(self):
  for tint in (-1,36,'10',True,None):
   with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT,'theme':{'primary':'','secondary':'','tint':tint}})

import base64
import site_background as bg_store
class SiteBackgroundImageTests(unittest.TestCase):
 SMALL_PNG=base64.b64encode(bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082')).decode()
 def test_save_and_read_round_trip(self):
  with patch.object(bg_store.store,'set',return_value=True) as mock_set, patch.object(bg_store.store,'get',side_effect=lambda k:mock_set.call_args[0][1]):
   version=bg_store.save_image(f'data:image/png;base64,{self.SMALL_PNG}')
   self.assertTrue(version.isdigit())
   record=bg_store.read_image()
   self.assertEqual(record['contentType'],'image/png')
   self.assertEqual(record['data'],self.SMALL_PNG)
 def test_save_rejects_malformed_or_wrong_type(self):
  for bad in ('not a data url',f'data:text/plain;base64,{self.SMALL_PNG}','data:image/png;base64,not-valid-base64!!!'):
   with self.assertRaises(ValueError):bg_store.save_image(bad)
 def test_save_rejects_oversized_image(self):
  huge=base64.b64encode(b'0'*(bg_store.MAX_BYTES+1)).decode()
  with self.assertRaises(ValueError):bg_store.save_image(f'data:image/jpeg;base64,{huge}')
 def test_read_returns_none_when_unset_or_corrupt(self):
  with patch.object(bg_store.store,'get',return_value=None):self.assertIsNone(bg_store.read_image())
  with patch.object(bg_store.store,'get',return_value='not json'):self.assertIsNone(bg_store.read_image())
 def test_same_origin(self):
  self.assertTrue(controls.same_origin({'Origin':'https://example.com','Host':'example.com'}));self.assertFalse(controls.same_origin({'Origin':'https://evil.com','Host':'example.com'}));self.assertFalse(controls.same_origin({'Host':'example.com'}))
 def test_required_login_cannot_be_bypassed_by_beta(self):
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'requireLogin':True}),patch.object(controls.admin_auth,'is_admin_request',return_value=False),patch.object(accounts,'identity',return_value=None):
   self.assertIsNone(auth_core.session_from_request_headers({}));self.assertIsNone(auth_core.session_with_live_access({}))
 def test_verified_account_has_access_without_discord_role(self):
  account={'id':'test-only','account':True}
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'requireLogin':True}),patch.object(controls.admin_auth,'is_admin_request',return_value=False),patch.object(accounts,'identity',return_value=account):self.assertEqual(auth_core.session_with_live_access({}),account)
 def test_cookies_secure_and_tokens_not_response_fields(self):
  cookies=accounts.session_cookies({'access_token':'mock-access','refresh_token':'mock-refresh','expires_in':60})
  self.assertTrue(all('HttpOnly; Secure; SameSite=Strict' in c for c in cookies))
  cleared=accounts.clear_cookies()
  self.assertEqual({c.split('=')[0] for c in cleared},{accounts.ACCESS,accounts.REFRESH,accounts.REMEMBER})
  self.assertTrue(all('Max-Age=0' in c for c in cleared))
 def test_invalid_provider_identity_not_account(self):
  accounts._identity_cache.clear()
  with patch.object(accounts,'call',return_value={'email':'test@example.invalid','email_confirmed_at':None}):self.assertIsNone(accounts.identity({'Cookie':accounts.ACCESS+'=mock'}))
 def test_shared_rate_counter(self):
  response=SimpleNamespace(raise_for_status=lambda:None,json=lambda:[{'result':21},{'result':1}])
  with patch.object(controls.store,'KV_URL','https://mock.invalid'),patch.object(controls.store,'KV_TOKEN','test-only'),patch.object(accounts.requests,'post',return_value=response):self.assertFalse(accounts.rate_allowed({},'test@example.invalid'))

class AccountRouteTests(unittest.TestCase):
 def request(self,body,headers=None):
  import io,json
  from api.session import handler
  request=object.__new__(handler)
  raw=json.dumps(body).encode()
  request.headers={'Origin':'https://test.invalid','Host':'test.invalid','Content-Length':str(len(raw)),**(headers or {})}
  request.rfile=io.BytesIO(raw)
  return request
 def test_csrf_rejected_before_provider(self):
  request=self.request({'action':'sign-in'}, {'Origin':'https://evil.invalid'})
  with patch.object(request,'_json') as send,patch.object(accounts,'call') as provider:
   request.do_POST();self.assertEqual(send.call_args.args[0],403);provider.assert_not_called()
 def test_registration_closed(self):
  request=self.request({'action':'sign-up','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'registrationOpen':False}),patch.object(accounts,'rate_allowed',return_value=True),patch.object(request,'_json') as send,patch.object(accounts,'call') as provider:
   request.do_POST();self.assertEqual(send.call_args.args[0],403);provider.assert_not_called()
 def test_login_response_has_no_tokens(self):
  request=self.request({'action':'sign-in','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(accounts,'rate_allowed',return_value=True),patch.object(accounts,'call',return_value={'access_token':'mock-access','refresh_token':'mock-refresh'}),patch.object(request,'_account_response') as send:
   request.do_POST();self.assertEqual(send.call_args.args[0],{'ok':True});self.assertIn('HttpOnly',send.call_args.args[1][0])
 def test_account_lockout(self):
  request=self.request({'action':'sign-in','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(accounts,'rate_allowed',return_value=False),patch.object(request,'_json') as send,patch.object(accounts,'call') as provider:
   request.do_POST();self.assertEqual(send.call_args.args[0],429);provider.assert_not_called()
 def test_provider_error_sanitized(self):
  request=self.request({'action':'sign-in','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(accounts,'rate_allowed',return_value=True),patch.object(accounts,'call',side_effect=RuntimeError('test-only secret')),patch.object(request,'_json') as send:
   request.do_POST();self.assertEqual(send.call_args.args[0],503);self.assertNotIn('secret',str(send.call_args.args[1]))

class ImmediateSignupTests(unittest.TestCase):
 def test_valid_provider_identity_does_not_require_email_confirmation(self):
  accounts._identity_cache.clear()
  with patch.object(accounts,'call',return_value={'id':'test-only','email':'test@example.invalid','email_confirmed_at':None}):
   self.assertEqual(accounts.identity({'Cookie':accounts.ACCESS+'=mock'})['id'],'test-only')
 def test_signup_auto_signs_in_when_provider_confirmation_disabled(self):
  request=AccountRouteTests().request({'action':'sign-up','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'registrationOpen':True}),patch.object(accounts,'rate_allowed',return_value=True),patch.object(accounts,'call',return_value={'access_token':'mock-access','refresh_token':'mock-refresh'}),patch.object(request,'_account_response') as send:
   request.do_POST();self.assertTrue(send.call_args.args[0]['signedIn']);self.assertNotIn('access_token',send.call_args.args[0])

import json,time
def _jwt(exp):
 """Shaped like a Supabase access token, expiring at `exp`."""
 enc=lambda d:base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
 return enc({'alg':'HS256'})+'.'+enc({'exp':int(exp),'sub':'test-only'})+'.sig'
USER={'id':'test-only','email':'test@example.invalid'}
def _rotated():return {'access_token':_jwt(time.time()+3600),'refresh_token':'new-refresh','expires_in':3600,'user':USER}

class SessionPersistenceTests(unittest.TestCase):
 """Members stay signed in until they sign out; Remember me is honoured."""
 def setUp(self):
  accounts._identity_cache.clear();self.kv={}
  self.patches=[patch.object(accounts,'_kv_get',side_effect=lambda k:self.kv.get(k)),patch.object(accounts,'_kv_setex',side_effect=lambda k,v,t:self.kv.__setitem__(k,v))]
  for p in self.patches:p.start()
 def tearDown(self):
  for p in self.patches:p.stop()
  accounts._identity_cache.clear()
 def test_remember_me_makes_cookies_persistent(self):
  jar=accounts.session_cookies({'access_token':'a','refresh_token':'r','expires_in':3600},remember=True)
  self.assertIn('Max-Age=3600',jar[0]);self.assertIn(f'Max-Age={accounts.REMEMBER_SECONDS}',jar[1]);self.assertTrue(jar[2].startswith(accounts.REMEMBER+'=1'))
 def test_not_remembered_uses_browser_session_cookies(self):
  jar=accounts.session_cookies({'access_token':'a','refresh_token':'r','expires_in':3600},remember=False)
  self.assertFalse(any('Max-Age' in c for c in jar));self.assertTrue(jar[2].startswith(accounts.REMEMBER+'=0'))
 def test_old_sessions_count_as_remembered(self):
  self.assertTrue(accounts.remembered({'Cookie':accounts.REFRESH+'=r'}));self.assertFalse(accounts.remembered({'Cookie':accounts.REMEMBER+'=0'}))
 def test_supabase_hiccup_does_not_sign_out_a_verified_member(self):
  token=_jwt(time.time()+3000)
  with patch.object(accounts,'call',return_value=USER):self.assertIsNotNone(accounts.identity_for_token(token))
  key=accounts._digest(token);accounts._identity_cache[key]=(0,accounts._identity_cache[key][1])  # verification now stale
  with patch.object(accounts,'call',side_effect=accounts.AccountUnavailable('busy')):self.assertEqual(accounts.identity_for_token(token)['id'],'test-only')
 def test_recent_verification_is_reused_without_asking_again(self):
  token=_jwt(time.time()+3000)
  with patch.object(accounts,'call',return_value=USER) as provider:
   accounts.identity_for_token(token);accounts.identity_for_token(token)
  self.assertEqual(provider.call_count,1)
 def test_unverified_token_fails_closed_when_supabase_is_down(self):
  with patch.object(accounts,'call',side_effect=accounts.AccountUnavailable('busy')):self.assertIsNone(accounts.identity_for_token(_jwt(time.time()+3000)))
 def test_rejected_token_is_not_signed_in(self):
  with patch.object(accounts,'call',side_effect=accounts.AccountRejected('Account rejected')):self.assertIsNone(accounts.identity_for_token(_jwt(time.time()+3000)))
 def test_expired_token_is_not_checked_with_supabase(self):
  with patch.object(accounts,'call') as provider:
   self.assertIsNone(accounts.identity_for_token(_jwt(time.time()-5)));provider.assert_not_called()
 def test_stored_verification_never_stands_in_for_a_non_supabase_token(self):
  # The hole an earlier test run opened: a stored identity for the plain
  # string "mock". A token with no expiry must never be served from cache.
  accounts._identity_cache[accounts._digest('mock')]=(time.time(),dict(USER))
  self.kv['krazy_data:account_identity:'+accounts._digest('mock')]={'verifiedAt':time.time(),'identity':dict(USER)}
  with patch.object(accounts,'call',side_effect=accounts.AccountRejected('Account rejected')):self.assertIsNone(accounts.identity_for_token('mock'))
  with patch.object(accounts,'call',side_effect=accounts.AccountUnavailable('busy')):self.assertIsNone(accounts.identity_for_token('mock'))
 def test_refresh_replay_survives_a_lost_response(self):
  with patch.object(accounts,'call',return_value=_rotated()) as provider:
   first=accounts.refresh_session('old-refresh');again=accounts.refresh_session('old-refresh')  # the browser never got `first`
  self.assertEqual(again,first);self.assertEqual(first['refresh_token'],'new-refresh')
  self.assertEqual(provider.call_count,1)  # the revoked token was never presented to Supabase again
 def test_session_refreshed_before_it_expires(self):
  headers={'Cookie':f'{accounts.ACCESS}={_jwt(time.time()+60)}; {accounts.REFRESH}=old-refresh; {accounts.REMEMBER}=1'}
  with patch.object(accounts,'call',return_value=_rotated()):ident,jar,pending=accounts.ensure_session(headers)
  self.assertEqual(ident['id'],'test-only');self.assertFalse(pending)
  self.assertTrue(any(c.startswith(accounts.REFRESH+'=new-refresh') and f'Max-Age={accounts.REMEMBER_SECONDS}' in c for c in jar))
 def test_refresh_keeps_the_remember_choice(self):
  headers={'Cookie':f'{accounts.REFRESH}=old; {accounts.REMEMBER}=0'}
  with patch.object(accounts,'call',return_value=_rotated()):_,jar,_=accounts.ensure_session(headers)
  self.assertTrue(jar);self.assertFalse(any('Max-Age' in c for c in jar))
 def test_fresh_session_is_left_alone(self):
  headers={'Cookie':f'{accounts.ACCESS}={_jwt(time.time()+3000)}; {accounts.REFRESH}=r'}
  with patch.object(accounts,'call',return_value=USER) as provider:ident,jar,pending=accounts.ensure_session(headers)
  self.assertEqual(jar,[]);self.assertEqual(ident['id'],'test-only');self.assertFalse(pending)
  self.assertEqual([c.args[0] for c in provider.call_args_list],['user'])
 def test_revoked_session_is_cleared(self):
  with patch.object(accounts,'call',side_effect=accounts.AccountRejected('Account rejected')):ident,jar,pending=accounts.ensure_session({'Cookie':accounts.REFRESH+'=dead'})
  self.assertIsNone(ident);self.assertFalse(pending);self.assertTrue(jar);self.assertTrue(all('Max-Age=0' in c for c in jar))
 def test_failed_refresh_keeps_cookies_and_retries(self):
  with patch.object(accounts,'call',side_effect=accounts.AccountUnavailable('busy')):ident,jar,pending=accounts.ensure_session({'Cookie':accounts.REFRESH+'=still-good'})
  self.assertIsNone(ident);self.assertEqual(jar,[]);self.assertTrue(pending)
 def test_no_cookies_is_simply_signed_out(self):
  with patch.object(accounts,'call') as provider:self.assertEqual(accounts.ensure_session({}),(None,[],False))
  provider.assert_not_called()

class RememberMeRouteTests(unittest.TestCase):
 def sign_in(self,**extra):
  request=AccountRouteTests().request({'action':'sign-in','email':'test@example.invalid','password':'test-only-password',**extra})
  with patch.object(accounts,'rate_allowed',return_value=True),patch.object(accounts,'call',return_value={'access_token':'a','refresh_token':'r'}),patch.object(request,'_account_response') as send:
   request.do_POST()
  return send.call_args.args[1]
 def test_sign_in_remembers_by_default(self):
  self.assertTrue(any(f'Max-Age={accounts.REMEMBER_SECONDS}' in c for c in self.sign_in()))
 def test_sign_in_without_remember_sets_session_cookies(self):
  self.assertFalse(any('Max-Age' in c for c in self.sign_in(remember=False)))
 def test_remember_must_be_a_boolean(self):
  request=AccountRouteTests().request({'action':'sign-in','email':'test@example.invalid','password':'test-only-password','remember':'yes'})
  with patch.object(request,'_json') as send,patch.object(accounts,'call') as provider:
   request.do_POST()
  self.assertEqual(send.call_args.args[0],400);provider.assert_not_called()
 def test_site_status_sets_refreshed_cookies(self):
  from api.session import handler
  request=object.__new__(handler);request.path='/api/session?action=site-status';request.headers={}
  with patch.object(accounts,'ensure_session',return_value=(dict(USER),['cookie-a','cookie-b'],False)),patch.object(controls,'read',return_value=dict(controls.DEFAULT)),patch.object(request,'_json') as send:
   request.do_GET()
  self.assertEqual(send.call_args.args[2],['cookie-a','cookie-b']);self.assertFalse(send.call_args.args[1]['refreshAvailable'])
