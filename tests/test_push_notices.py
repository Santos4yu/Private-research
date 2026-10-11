import io
import json
import os
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

import account_auth as accounts
import push_notices as push
import site_controls as controls

APPLE = 'https://web.push.apple.com/QGuQyavXutnMH0bFwbjmWo3Nj6ZVg'


class FakeKV:
    """The KV commands push_notices uses, in memory."""

    def __init__(self):
        self.data = {}

    def __call__(self, commands):
        return [self.run(*command) for command in commands]

    def run(self, name, key, *args):
        if name == 'GET':
            return self.data.get(key)
        if name == 'SET':
            if 'NX' in args[1:] and key in self.data:
                return None
            self.data[key] = args[0]
            return 'OK'
        table = self.data.setdefault(key, {})
        if name == 'HSET':
            table[args[0]] = args[1]
            return 1
        if name == 'HDEL':
            return sum(table.pop(field, None) is not None for field in args)
        if name == 'HGETALL':
            return [item for pair in table.items() for item in pair]
        if name == 'HLEN':
            return len(table)
        raise AssertionError(name)


def phone():
    """A device's key pair and auth secret, and the subscription it would send."""
    private = ec.generate_private_key(ec.SECP256R1())
    auth = os.urandom(16)
    subscription = {'endpoint': APPLE + push.b64url(os.urandom(6)),
                    'keys': {'p256dh': push.b64url(push._point(private.public_key())), 'auth': push.b64url(auth)}}
    return private, auth, subscription


def decrypt(body, private, auth):
    """What the phone does with a message (RFC 8291), written out separately."""
    salt, idlen = body[:16], body[20]
    sender = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), body[21:21 + idlen])
    shared = private.exchange(ec.ECDH(), sender)
    own = push._point(private.public_key())
    ikm = HKDF(hashes.SHA256(), 32, auth, b'WebPush: info\x00' + own + body[21:21 + idlen]).derive(shared)
    key = HKDF(hashes.SHA256(), 16, salt, b'Content-Encoding: aes128gcm\x00').derive(ikm)
    nonce = HKDF(hashes.SHA256(), 12, salt, b'Content-Encoding: nonce\x00').derive(ikm)
    plain = AESGCM(key).decrypt(nonce, body[21 + idlen:], None)
    assert plain.endswith(b'\x02')
    return plain[:-1]


class KeyTests(unittest.TestCase):
    def setUp(self):
        push._keys.clear()
        self.addCleanup(push._keys.clear)
        self.kv = FakeKV()
        patcher = patch.object(push, '_pipeline', self.kv)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_the_sites_key_is_made_once_and_kept(self):
        with patch.dict(os.environ, {'VAPID_PRIVATE_KEY': ''}):
            first = push.public_key()
            push._keys.clear()
            self.assertEqual(push.public_key(), first)
        self.assertEqual(len(push.unb64url(first)), 65)
        self.assertEqual(len(push.unb64url(self.kv.data[push.VAPID_KEY])), 32)

    def test_a_racing_request_keeps_the_key_stored_first(self):
        self.kv.data[push.VAPID_KEY] = push.b64url((12345).to_bytes(32, 'big'))
        with patch.dict(os.environ, {'VAPID_PRIVATE_KEY': ''}):
            expected = push.b64url(push._point(ec.derive_private_key(12345, ec.SECP256R1()).public_key()))
            self.assertEqual(push.public_key(), expected)

    def test_a_key_in_the_environment_wins(self):
        with patch.dict(os.environ, {'VAPID_PRIVATE_KEY': 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'}):
            self.assertEqual(push.public_key(), 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8')
        self.assertNotIn(push.VAPID_KEY, self.kv.data)

    def test_vapid_header_is_a_signed_token_for_the_push_service(self):
        with patch.dict(os.environ, {'VAPID_PRIVATE_KEY': ''}):
            header = push.vapid_header(APPLE + 'abc', 'https://krazydata.example', now=1_000_000)
        token, key = header.removeprefix('vapid t=').split(', k=')
        head, claims, signature = token.split('.')
        self.assertEqual(json.loads(push.unb64url(head)), {'typ': 'JWT', 'alg': 'ES256'})
        self.assertEqual(json.loads(push.unb64url(claims)),
                         {'aud': 'https://web.push.apple.com', 'exp': 1_000_000 + 12 * 3600, 'sub': 'https://krazydata.example'})
        raw = push.unb64url(signature)
        public = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), push.unb64url(key))
        public.verify(encode_dss_signature(int.from_bytes(raw[:32], 'big'), int.from_bytes(raw[32:], 'big')),
                      f'{head}.{claims}'.encode(), ec.ECDSA(hashes.SHA256()))


class EncryptionTests(unittest.TestCase):
    def test_rfc_8291_example(self):
        sender = ec.derive_private_key(int.from_bytes(push.unb64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), 'big'),
                                       ec.SECP256R1())
        body = push.encrypt(b'When I grow up, I want to be a watermelon',
                            'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
                            'BTBZMqHH6r4Tts7J_aSIgg', salt=push.unb64url('DGv6ra1nlYgDCS1FRnbzlw'), sender=sender)
        self.assertEqual(push.b64url(body),
                         'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_'
                         'yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')

    def test_only_the_phone_can_read_its_message(self):
        private, auth, subscription = phone()
        message = json.dumps({'title': 'Ace Props', 'body': 'NHL is live 🏒'}).encode()
        body = push.encrypt(message, subscription['keys']['p256dh'], subscription['keys']['auth'])
        self.assertEqual(decrypt(body, private, auth), message)
        other, _, _ = phone()
        with self.assertRaises(Exception):
            decrypt(body, other, auth)


class SubscriptionTests(unittest.TestCase):
    def test_only_real_push_services_and_well_formed_keys(self):
        _, _, good = phone()
        self.assertEqual(push.valid_subscription({**good, 'expirationTime': None}), good)
        for endpoint in ('https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x',
                         'https://wns2-bl2p.notify.windows.com/w/?token=x'):
            push.valid_subscription({**good, 'endpoint': endpoint})
        bad = [None, 'x', {**good, 'endpoint': 'http://web.push.apple.com/x'},
               {**good, 'endpoint': 'https://evil.example/x'}, {**good, 'endpoint': 'https://push.apple.com.evil.example/x'},
               {**good, 'endpoint': 'https://169.254.169.254/latest'},
               {**good, 'keys': {**good['keys'], 'auth': push.b64url(b'short')}},
               {**good, 'keys': {**good['keys'], 'p256dh': '!!'}}, {**good, 'keys': None}]
        for value in bad:
            with self.assertRaises(ValueError, msg=value):
                push.valid_subscription(value)

    def test_subscribe_replaces_the_same_device_and_unsubscribe_removes_it(self):
        kv = FakeKV()
        _, _, device = phone()
        with patch.object(push, '_pipeline', kv):
            push.subscribe('uid-1', device)
            push.subscribe('uid-1', device)
            _, _, second = phone()
            push.subscribe('uid-2', second)
            self.assertEqual(push.status()['devices'], 2)
            push.unsubscribe(device['endpoint'])
            self.assertEqual([record['account'] for record in push.subscriptions().values()], ['uid-2'])

    def test_announcement_text_is_checked(self):
        self.assertEqual(push.valid_announcement('', 'New props are up'), {'title': 'Ace Props', 'body': 'New props are up', 'url': '/'})
        self.assertEqual(push.valid_announcement(' Big   update ', 'x', '//evil.example')['title'], 'Big update')
        self.assertEqual(push.valid_announcement('t', 'x', '//evil.example')['url'], '/')
        self.assertEqual(push.valid_announcement('t', 'x', 'https://evil.example')['url'], '/')
        self.assertEqual(push.valid_announcement('t', 'x', '/?tab=finder')['url'], '/?tab=finder')
        for body in ('', '   ', 'x' * (push.BODY_MAX + 1)):
            with self.assertRaises(ValueError):
                push.valid_announcement('t', body)


class AnnounceTests(unittest.TestCase):
    def setUp(self):
        self.kv = FakeKV()
        patcher = patch.object(push, '_pipeline', self.kv)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.devices = {}
        for name, account in (('ok', 'uid-1'), ('gone', 'uid-2'), ('missing', 'uid-2'), ('down', 'uid-3'), ('broken', 'uid-3')):
            _, _, subscription = phone()
            self.devices[name] = subscription
            push.subscribe(account, subscription)
        self.codes = {self.devices['ok']['endpoint']: 201, self.devices['gone']['endpoint']: 410,
                      self.devices['missing']['endpoint']: 404, self.devices['down']['endpoint']: 500}

    def send(self, subscription, payload, subject):
        self.sent.append((subscription['endpoint'], json.loads(payload), subject))
        if subscription['endpoint'] not in self.codes:
            raise ConnectionError('offline')
        return self.codes[subscription['endpoint']]

    def test_everyone_gets_it_and_dead_devices_are_dropped(self):
        self.sent = []
        with patch.object(push, 'send_one', self.send):
            result = push.announce('Update', 'NHL props are live', 'https://krazydata.example')
        self.assertEqual(result, {'sent': 1, 'removed': 2, 'failed': 2})
        self.assertEqual(len(self.sent), 5)
        self.assertEqual({(message['title'], message['body'], message['url']) for _, message, _ in self.sent},
                         {('Update', 'NHL props are live', '/')})
        self.assertEqual({subject for _, _, subject in self.sent}, {'https://krazydata.example'})
        status = push.status()
        self.assertEqual(status['devices'], 3)
        self.assertEqual((status['last']['body'], status['last']['sent']), ('NHL props are live', 1))

    def test_send_to_me_only_reaches_my_devices_and_isnt_the_last_announcement(self):
        self.sent = []
        with patch.object(push, 'send_one', self.send):
            result = push.announce('Test', 'Just me', 'https://krazydata.example', account_id='uid-1')
        self.assertEqual(result, {'sent': 1, 'removed': 0, 'failed': 0})
        self.assertEqual([endpoint for endpoint, _, _ in self.sent], [self.devices['ok']['endpoint']])
        self.assertIsNone(push.status()['last'])

    def test_a_real_send_is_encrypted_and_signed(self):
        private, auth, subscription = phone()
        captured = {}

        class Response:
            status_code = 201

        def post(url, data, headers, timeout):
            captured.update(url=url, data=data, headers=headers)
            return Response()
        push._keys.clear()
        self.addCleanup(push._keys.clear)
        with patch.dict(os.environ, {'VAPID_PRIVATE_KEY': ''}), patch.object(push.requests, 'post', post):
            self.assertEqual(push.send_one(subscription, b'{"body":"hi"}', 'https://krazydata.example'), 201)
        self.assertEqual(captured['url'], subscription['endpoint'])
        self.assertEqual(decrypt(captured['data'], private, auth), b'{"body":"hi"}')
        self.assertEqual(captured['headers']['Content-Encoding'], 'aes128gcm')
        self.assertTrue(captured['headers']['Authorization'].startswith('vapid t='))
        self.assertEqual(int(captured['headers']['TTL']), push.TTL_SECONDS)


def load_admin_handler():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location('v2_admin', Path(__file__).resolve().parents[1] / 'api' / 'v2-admin.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.handler


def call(handler, method, body=None, query='', same_origin=True):
    request = object.__new__(handler)
    raw = json.dumps(body or {}).encode()
    request.path = query
    request.headers = {'Content-Length': str(len(raw)), 'Origin': 'https://example.com',
                       'Host': 'example.com' if same_origin else 'evil.com'}
    request.rfile = io.BytesIO(raw)
    name = '_send' if hasattr(handler, '_send') else '_json'
    with patch.object(request, name) as send:
        getattr(request, method)()
    return send.call_args.args[:2]


class RouteTests(unittest.TestCase):
    def setUp(self):
        push._keys.clear()
        self.addCleanup(push._keys.clear)
        self.kv = FakeKV()
        for patcher in (patch.object(push, '_pipeline', self.kv), patch.dict(os.environ, {'VAPID_PRIVATE_KEY': ''})):
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_members_turn_alerts_on_and_off(self):
        from api.session import handler
        self.assertEqual(call(handler, 'do_GET', query='/api/session?action=push-key'), (200, {'key': push.public_key()}))
        _, _, device = phone()
        with patch.object(accounts, 'identity', return_value=None):
            self.assertEqual(call(handler, 'do_POST', {'action': 'push-subscribe', 'subscription': device})[0], 401)
        with patch.object(accounts, 'identity', return_value={'id': 'uid-1'}):
            self.assertEqual(call(handler, 'do_POST', {'action': 'push-subscribe', 'subscription': device}, same_origin=False)[0], 403)
            self.assertEqual(call(handler, 'do_POST', {'action': 'push-subscribe', 'subscription': {'endpoint': 'https://evil.example'}})[0], 400)
            self.assertEqual(call(handler, 'do_POST', {'action': 'push-subscribe', 'subscription': device}), (200, {'ok': True}))
            self.assertEqual([record['account'] for record in push.subscriptions().values()], ['uid-1'])
            self.assertEqual(call(handler, 'do_POST', {'action': 'push-unsubscribe', 'subscription': {'endpoint': device['endpoint']}}),
                             (200, {'ok': True}))
        self.assertEqual(push.subscriptions(), {})

    def test_announcing_is_admin_only(self):
        handler = load_admin_handler()
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=False):
            self.assertEqual(call(handler, 'do_GET', query='/api/v2-admin?action=announce-status')[0], 401)
            self.assertEqual(call(handler, 'do_POST', {'action': 'announce', 'body': 'hi'})[0], 401)
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=True):
            self.assertEqual(call(handler, 'do_POST', {'action': 'announce', 'body': 'hi'}, same_origin=False)[0], 403)

    def test_admin_sends_and_sees_the_result(self):
        handler = load_admin_handler()
        _, _, mine = phone()
        _, _, theirs = phone()
        push.subscribe('admin-uid', mine)
        push.subscribe('uid-2', theirs)
        sent = []
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=True), \
                patch.object(push, 'send_one', lambda subscription, payload, subject: sent.append((subscription['endpoint'], subject)) or 201):
            self.assertEqual(call(handler, 'do_POST', {'action': 'announce', 'body': ''})[0], 400)
            with patch.object(accounts, 'identity', return_value=None):
                self.assertEqual(call(handler, 'do_POST', {'action': 'announce', 'body': 'hi', 'onlyMe': True})[0], 400)
            with patch.object(accounts, 'identity', return_value={'id': 'admin-uid'}):
                status, body = call(handler, 'do_POST', {'action': 'announce', 'body': 'hi', 'onlyMe': True})
            self.assertEqual((status, body['sent'], body['devices']), (200, 1, 2))
            self.assertEqual(sent, [(mine['endpoint'], 'https://example.com')])
            status, body = call(handler, 'do_POST', {'action': 'announce', 'title': 'Update', 'body': 'New props are up'})
        self.assertEqual((status, body['sent'], body['last']['body']), (200, 2, 'New props are up'))
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=True):
            status, body = call(handler, 'do_GET', query='/api/v2-admin?action=announce-status')
        self.assertEqual((status, body['devices'], body['last']['title']), (200, 2, 'Update'))


if __name__ == '__main__':
    unittest.main()
