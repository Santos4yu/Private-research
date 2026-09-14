import unittest
from unittest.mock import patch
from types import SimpleNamespace
import site_controls as controls
import account_auth as accounts
import auth_core
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
  self.assertTrue(all('HttpOnly; Secure; SameSite=Strict' in c for c in cookies));self.assertEqual(len(accounts.clear_cookies()),2)
 def test_invalid_provider_identity_not_account(self):
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
  with patch.object(accounts,'call',return_value={'id':'test-only','email':'test@example.invalid','email_confirmed_at':None}):
   self.assertEqual(accounts.identity({'Cookie':accounts.ACCESS+'=mock'})['id'],'test-only')
 def test_signup_auto_signs_in_when_provider_confirmation_disabled(self):
  request=AccountRouteTests().request({'action':'sign-up','email':'test@example.invalid','password':'test-only-password'})
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'registrationOpen':True}),patch.object(accounts,'rate_allowed',return_value=True),patch.object(accounts,'call',return_value={'access_token':'mock-access','refresh_token':'mock-refresh'}),patch.object(request,'_account_response') as send:
   request.do_POST();self.assertTrue(send.call_args.args[0]['signedIn']);self.assertNotIn('access_token',send.call_args.args[0])
