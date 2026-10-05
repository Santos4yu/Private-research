import base64
import io
import json
import unittest
from unittest.mock import patch

import account_auth as accounts
import account_profile as profiles
import site_controls as controls

# Same rule as test_site_access.py: nothing here may reach the real KV store.
_kv_off = patch.object(accounts, '_kv', return_value=None)


def setUpModule():
    _kv_off.start()


def tearDownModule():
    _kv_off.stop()


UID = '11111111-1111-4111-8111-111111111111'
OTHER = '22222222-2222-4222-8222-222222222222'
PNG = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'0' * 64).decode()


class FakeStore:
    KV_URL = 'mem'
    KV_TOKEN = 'mem'
    TIMEOUT = 2

    def __init__(self):
        self.data = {}

    def get(self, key, **_):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value
        return True

    def pipeline(self, commands):
        return [{'result': [self.data.get(key) for key in command[1:]]} for command in commands]


def fake():
    store = FakeStore()
    return store, patch.object(profiles, 'store', store), patch.object(profiles, '_pipeline', store.pipeline)


class ProfileTests(unittest.TestCase):
    def test_names_are_cleaned_and_reserved_names_refused(self):
        self.assertEqual(profiles.clean_name('  Santos ​  Damian\n'), 'Santos Damian')
        self.assertEqual(profiles.clean_name(None), '')
        for name in ('Admin', 'ADMINISTRATOR', 'Krazy Data', 'm.o.d', 'x' * 33, 42):
            with self.assertRaises(ValueError, msg=name):
                profiles.clean_name(name)

    def test_save_profile_with_photo_and_remove_it(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            saved = profiles.save_profile(UID, name='Santos', avatar=PNG)
            shown = profiles.public_profile(UID, saved)
            self.assertEqual(shown['name'], 'Santos')
            self.assertIn(f'u={UID}&slot=avatar&v=', shown['avatarUrl'])
            self.assertEqual(profiles.read_image(UID, 'avatar')['contentType'], 'image/png')
            # Changing only the name keeps the photo.
            self.assertEqual(profiles.save_profile(UID, name='S')['avatar'], saved['avatar'])
            self.assertIsNone(profiles.public_profile(UID, profiles.save_profile(UID, avatar=None))['avatarUrl'])
        with self.assertRaises(ValueError):
            profiles.save_profile('not-a-uid', name='x')

    def test_images_are_checked(self):
        store, *patches = fake()
        big = 'data:image/jpeg;base64,' + base64.b64encode(b'0' * (profiles.IMAGE_SLOTS['avatar'] + 1)).decode()
        with patches[0], patches[1]:
            for bad in ('data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,***', big, None, 'https://x/y.png'):
                with self.assertRaises(ValueError):
                    profiles.save_image(UID, 'avatar', bad)
            with self.assertRaises(ValueError):
                profiles.save_image(UID, 'banner', PNG)
            self.assertIsNone(profiles.read_image('../etc', 'avatar'))


class PrefsTests(unittest.TestCase):
    def test_each_setting_keeps_the_newest_change(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            profiles.merge_prefs(UID, {'accent': {'value': {'primary': '#111111'}, 'at': 200},
                                       'slip': {'value': [{'id': 'a'}], 'at': 100}})
            # Another device: an older accent, a newer slip.
            merged = profiles.merge_prefs(UID, {'accent': {'value': {'primary': '#999999'}, 'at': 150},
                                                'slip': {'value': [], 'at': 300}})
        self.assertEqual(merged['accent']['value'], {'primary': '#111111'})
        self.assertEqual(merged['slip'], {'value': [], 'at': 300})

    def test_settings_are_validated(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            for changes in ({}, {'unknown': {'value': 1, 'at': 1}}, {'slip': {'value': {}, 'at': 1}},
                            {'slip': {'value': [], 'at': 0}}, {'slip': {'value': [], 'at': True}},
                            {'background': {'value': {'url': 'data:image/png;base64,AAAA', 'opacity': 30}, 'at': 1}},
                            {'recentNfl': {'value': ['x' * (profiles.MAX_PREFS_BYTES + 1)], 'at': 1}}):
                with self.assertRaises(ValueError, msg=str(changes)[:60]):
                    profiles.merge_prefs(UID, changes)
            # Removing a setting is a change too.
            self.assertIsNone(profiles.merge_prefs(UID, {'background': {'value': None, 'at': 5}})['background']['value'])

    def test_accounts_never_see_each_others_settings(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            profiles.merge_prefs(UID, {'slip': {'value': [{'id': 'a'}], 'at': 1}})
            self.assertEqual(profiles.read_prefs(OTHER), {})


class CommunityTests(unittest.TestCase):
    def test_posts_show_names_and_photos_never_emails(self):
        store, *patches = fake()
        posts = [{'id': 'p1', 'authorId': UID, 'authorName': 'santos@example.com'},
                 {'id': 'p2', 'authorId': OTHER, 'authorName': 'other@example.com'},
                 {'id': 'p3', 'authorId': 'admin', 'authorName': 'Administrator'},
                 {'id': 'p4', 'authorId': '123456789012345678', 'authorName': 'discord_user'},
                 {'id': 'p5', 'authorId': '123456789012345679', 'authorName': 'old@example.com'}]
        with patches[0], patches[1]:
            profiles.save_profile(UID, name='Santos', avatar=PNG)
            shown = profiles.community_authors(posts)
        self.assertEqual([post['authorName'] for post in shown], ['Santos', 'Member', 'Administrator', 'discord_user', 'Member'])
        self.assertTrue(shown[0]['authorAvatar'].startswith('/api/session?action=account-image'))
        self.assertIsNone(shown[1]['authorAvatar'])
        self.assertNotIn('@', json.dumps(shown))


class RouteTests(unittest.TestCase):
    def call(self, method, body=None, query='', account=None):
        from api.session import handler
        request = object.__new__(handler)
        raw = json.dumps(body or {}).encode()
        request.path = '/api/session' + query
        request.headers = {'Content-Length': str(len(raw)), 'Origin': 'https://example.com', 'Host': 'example.com'}
        request.rfile = io.BytesIO(raw)
        user = {'id': account, 'email': 'santos@example.com', 'account': True} if account else None
        with patch.object(accounts, 'identity', return_value=user), patch.object(request, '_json') as send:
            getattr(request, method)()
        return send.call_args.args

    def test_account_routes_need_a_signed_in_member(self):
        self.assertEqual(self.call('do_GET', query='?action=account')[0], 401)
        self.assertEqual(self.call('do_POST', {'action': 'profile-save', 'name': 'x'})[0], 401)
        self.assertEqual(self.call('do_POST', {'action': 'prefs-save', 'changes': {}})[0], 401)

    def test_profile_and_settings_round_trip(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            status, body = self.call('do_POST', {'action': 'profile-save', 'name': 'Santos'}, account=UID)
            self.assertEqual((status, body['profile']['name']), (200, 'Santos'))
            self.assertEqual(self.call('do_POST', {'action': 'profile-save', 'name': 'admin'}, account=UID)[0], 400)
            self.assertEqual(self.call('do_POST', {'action': 'prefs-save', 'changes': {'accent': {'value': {'primary': '#123456'}, 'at': 9}}}, account=UID)[0], 200)
            status, body = self.call('do_GET', query='?action=account', account=UID)
        self.assertEqual(status, 200)
        self.assertEqual(body['profile']['name'], 'Santos')
        self.assertEqual(body['prefs']['accent']['value'], {'primary': '#123456'})

    def test_background_photo_upload_returns_its_link(self):
        store, *patches = fake()
        with patches[0], patches[1]:
            status, body = self.call('do_POST', {'action': 'account-image-save', 'slot': 'background', 'image': PNG}, account=UID)
            self.assertEqual(self.call('do_POST', {'action': 'account-image-save', 'slot': 'avatar', 'image': PNG}, account=UID)[0], 400)
        self.assertEqual(status, 200)
        self.assertIn('slot=background', body['url'])

    def test_large_bodies_are_only_for_account_data(self):
        padding = 'x' * 9000
        status, _ = self.call('do_POST', {'action': 'sign-in', 'email': 'a@example.com', 'password': padding})
        self.assertEqual(status, 400)


if __name__ == '__main__':
    unittest.main()


class SignOutTests(unittest.TestCase):
    def test_signing_out_ends_only_this_devices_session(self):
        from api.session import handler
        request = object.__new__(handler)
        raw = json.dumps({'action': 'sign-out'}).encode()
        request.path = '/api/session'
        request.headers = {'Content-Length': str(len(raw)), 'Origin': 'https://example.com', 'Host': 'example.com',
                           'Cookie': f'{accounts.ACCESS}=token-1; {accounts.REFRESH}=refresh-1'}
        request.rfile = io.BytesIO(raw)
        with patch.object(accounts, 'call', return_value={}) as call, patch.object(request, '_account_response') as send:
            request.do_POST()
        # Supabase's default would end the member's sessions on every device.
        self.assertEqual(call.call_args.args[0], 'logout?scope=local')
        self.assertEqual(call.call_args.kwargs['token'], 'token-1')
        body, cookies = send.call_args.args
        self.assertTrue(body['ok'])
        self.assertTrue(any(cookie.startswith(f'{accounts.REFRESH}=;') and 'Max-Age=0' in cookie for cookie in cookies))
