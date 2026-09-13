import unittest
from unittest.mock import patch
from types import SimpleNamespace
import site_controls as controls
import account_auth as accounts
import auth_core
class SiteControlsTests(unittest.TestCase):
 def test_default_preserves_public_beta(self):
  with patch.object(controls.store,'get',return_value=None):self.assertFalse(controls.read()['requireLogin'])
 def test_validate_boolean_tabs_and_message(self):
  for value in ({**controls.DEFAULT,'maintenance':'false'},{**controls.DEFAULT,'disabledTabs':['admin']},{**controls.DEFAULT,'message':''}):
   with self.assertRaises(ValueError):controls.validate(value)
 def test_maintenance_and_disabled_props_enforced_admin_bypasses(self):
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'disabledTabs':['v2']}),patch.object(controls.admin_auth,'is_admin_request',return_value=False):
   self.assertFalse(controls.allowed({},'v2'));self.assertTrue(controls.allowed({},'research'))
  with patch.object(controls,'read',return_value={**controls.DEFAULT,'maintenance':True}),patch.object(controls.admin_auth,'is_admin_request',return_value=True):self.assertTrue(controls.allowed({},'v2'))
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
