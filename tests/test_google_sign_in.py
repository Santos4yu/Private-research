import base64
import hashlib
import io
import os
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import account_auth as accounts

ENV = {'SUPABASE_URL': 'https://project.supabase.co', 'SUPABASE_ANON_KEY': 'anon', 'SUPABASE_SECRET_KEY': 'sb_secret_x'}
# Nothing here may reach the real KV store.
_kv_off = patch.object(accounts, '_kv', return_value=None)


def setUpModule():
    _kv_off.start()


def tearDownModule():
    _kv_off.stop()


def ago(seconds):
    return datetime.fromtimestamp(time.time() - seconds, timezone.utc).isoformat().replace('+00:00', 'Z')


def ask(query, cookie=''):
    """GET /api/session<query>; (status, Location, Set-Cookie headers)."""
    from api.session import handler
    request = object.__new__(handler)
    request.path = '/api/session' + query
    request.headers = {'Host': 'www.krazydata.site', 'Cookie': cookie}
    request.rfile = io.BytesIO()
    sent = {'status': None, 'headers': []}
    request.send_response = lambda status, *_: sent.update(status=status)
    request.send_header = lambda name, value: sent['headers'].append((name, value))
    request.end_headers = lambda: None
    request.wfile = io.BytesIO()
    request.do_GET()
    location = next((value for name, value in sent['headers'] if name == 'Location'), None)
    return sent['status'], location, [value for name, value in sent['headers'] if name == 'Set-Cookie']


def session(created):
    return {'access_token': 'header.eyJleHAiOjQxMDI0NDQ4MDB9.sig', 'refresh_token': 'refresh-2', 'expires_in': 3600,
            'user': {'id': 'user-1', 'email': 'member@gmail.com', 'created_at': created}}


@patch.dict(os.environ, ENV)
class GoogleSignInTests(unittest.TestCase):
    def test_continue_with_google_goes_to_supabase_with_a_verifier_kept_server_side(self):
        status, location, cookies = ask('?action=oauth&provider=google&remember=0')
        self.assertEqual(status, 302)
        url = urlparse(location)
        query = {key: values[0] for key, values in parse_qs(url.query).items()}
        self.assertEqual(f'{url.scheme}://{url.netloc}{url.path}', 'https://project.supabase.co/auth/v1/authorize')
        self.assertEqual(query['provider'], 'google')
        self.assertEqual(query['redirect_to'], 'https://www.krazydata.site/api/session?action=oauth-callback')
        self.assertEqual(query['code_challenge_method'], 's256')
        [cookie] = cookies
        value = cookie.split(';')[0].split('=', 1)[1]
        verifier, remember = value.split('.')
        self.assertEqual(remember, '0')
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        self.assertEqual(query['code_challenge'], challenge)
        # It has to come back on the cross-site return from Google, and only to this endpoint.
        for flag in ('HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/session', 'Max-Age=600'):
            self.assertIn(flag, cookie)

    def test_only_google_is_offered(self):
        status, location, cookies = ask('?action=oauth&provider=github')
        self.assertEqual((status, location, cookies), (302, '/sign-in?auth=google-failed', []))

    def test_a_returning_member_is_signed_in_with_the_usual_cookies(self):
        with patch.object(accounts, 'call', return_value=session(ago(90 * 24 * 3600))) as call, \
             patch('site_controls.read', return_value={'registrationOpen': False}):
            status, location, cookies = ask('?action=oauth-callback&code=code-1', f'{accounts.OAUTH_COOKIE}=verifier-1.1')
        self.assertEqual(call.call_args.args, ('token?grant_type=pkce', {'auth_code': 'code-1', 'code_verifier': 'verifier-1'}))
        self.assertEqual((status, location), (302, '/'))
        self.assertTrue(any(cookie.startswith(f'{accounts.REFRESH}=refresh-2') and 'Max-Age=' in cookie for cookie in cookies))
        self.assertTrue(any(cookie.startswith(f'{accounts.OAUTH_COOKIE}=;') and 'Max-Age=0' in cookie for cookie in cookies))

    def test_with_sign_ups_closed_a_new_google_account_is_refused_and_removed(self):
        with patch.object(accounts, 'call', return_value=session(ago(5))), \
             patch.object(accounts, 'remove_account', return_value=True) as remove, \
             patch('site_controls.read', return_value={'registrationOpen': False}):
            status, location, cookies = ask('?action=oauth-callback&code=code-1', f'{accounts.OAUTH_COOKIE}=verifier-1.1')
        remove.assert_called_once_with('user-1')
        self.assertEqual(location, '/sign-in?auth=google-closed')
        self.assertFalse(any(cookie.startswith(accounts.REFRESH) and 'Max-Age=0' not in cookie for cookie in cookies))

    def test_an_account_that_could_not_be_removed_stays_refused(self):
        stored = {}
        with patch.object(accounts, '_kv_setex', side_effect=lambda key, value, seconds: stored.update({key: value})), \
             patch.object(accounts, '_kv_get', side_effect=stored.get), \
             patch.object(accounts, 'remove_account', return_value=False):
            accounts.refuse_account('user-1')
            self.assertTrue(accounts.was_refused('user-1'))
            self.assertFalse(accounts.was_refused('user-2'))

    def test_with_sign_ups_open_a_new_google_account_is_signed_in(self):
        with patch.object(accounts, 'call', return_value=session(ago(5))), \
             patch.object(accounts, 'remove_account') as remove, \
             patch('site_controls.read', return_value={'registrationOpen': True}):
            _, location, cookies = ask('?action=oauth-callback&code=code-1', f'{accounts.OAUTH_COOKIE}=verifier-1.1')
        remove.assert_not_called()
        self.assertEqual(location, '/')
        self.assertTrue(any(cookie.startswith(f'{accounts.ACCESS}=') for cookie in cookies))

    def test_cancelled_failed_and_expired_returns_go_back_to_sign_in(self):
        self.assertEqual(ask('?action=oauth-callback&error=access_denied', f'{accounts.OAUTH_COOKIE}=v.1')[1], '/sign-in?auth=google-cancelled')
        self.assertEqual(ask('?action=oauth-callback&code=code-1')[1], '/sign-in?auth=google-expired')
        with patch.object(accounts, 'call', side_effect=accounts.AccountRejected('Account request unsuccessful')):
            self.assertEqual(ask('?action=oauth-callback&code=code-1', f'{accounts.OAUTH_COOKIE}=v.1')[1], '/sign-in?auth=google-failed')

    def test_the_google_button_shows_only_when_supabase_has_it_on(self):
        accounts._providers.update(at=0, value=None)
        with patch.object(accounts, 'call', return_value={'external': {'google': True, 'apple': False}}) as call:
            self.assertEqual(accounts.enabled_providers(), ['google'])
            self.assertEqual(accounts.enabled_providers(), ['google'])
        self.assertEqual(call.call_count, 1)
        accounts._providers.update(at=0, value=None)
        with patch.object(accounts, 'call', return_value={'external': {'google': False}}):
            self.assertEqual(accounts.enabled_providers(), [])
        accounts._providers.update(at=0, value=None)


if __name__ == '__main__':
    unittest.main()
