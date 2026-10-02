"""Offline migration preparation. No destination writes or live cutover.

Backups contain secrets and member data. Never print/upload their contents.
An export requires a readable source and paused writers; a suspended source
cannot be recovered by this tool. SQL output is an operator-reviewed artifact.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.board import store

POLICY = 'krazy_data:site_controls:v1'
RULES = 'krazy_data:member_rules:v1'
SOURCE = 'https://excited-minnow-157991.upstash.io'


def validate_backup(backup):
    if not isinstance(backup, dict) or backup.get('version') != 1 or backup.get('source') != SOURCE:
        raise ValueError('Use a version-1 backup of the original website database')
    if backup.get('complete') is not True or backup.get('writersPaused') is not True:
        raise ValueError('A complete backup with paused source writers is required')
    entries = backup.get('entries')
    if not isinstance(entries, list):
        raise ValueError('Invalid backup entries')
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError('Invalid backup record')
        key, kind, value = entry.get('key'), entry.get('kind'), entry.get('value')
        if not isinstance(key, str) or not 1 <= len(key.encode()) <= 1024 or key in seen:
            raise ValueError('Invalid or duplicate backup key')
        seen.add(key)
        if kind == 'string':
            valid = isinstance(value, str)
        elif kind == 'hash':
            valid = isinstance(value, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in value.items())
        elif kind == 'list':
            valid = isinstance(value, list) and all(isinstance(v, str) for v in value)
        elif kind == 'zset':
            valid = isinstance(value, dict) and all(isinstance(k, str) and isinstance(v, (int, float))
                    and not isinstance(v, bool) and math.isfinite(v) for k, v in value.items())
        else:
            valid = False
        if not valid:
            raise ValueError('Unsupported or invalid backup value')
        expiry = entry.get('expiresAt')
        if expiry is not None and (isinstance(expiry, bool) or not isinstance(expiry, (float, int)) or not math.isfinite(expiry)):
            raise ValueError('Invalid backup expiry')
    by_key = {entry['key']: entry for entry in entries}
    for key in (POLICY, RULES):
        if key not in by_key or by_key[key]['kind'] != 'string' or by_key[key].get('expiresAt') is not None:
            raise ValueError('Saved visibility settings and member rules must both be present without expiry')
    policy = json.loads(by_key[POLICY]['value'])
    rules = json.loads(by_key[RULES]['value'])
    if not isinstance(policy, dict) or policy.get('requireLogin') is not True:
        raise ValueError('Restored policy must explicitly keep sign-in required')
    import site_controls
    allowed_lists = {'disabledTabs': site_controls.TABS, 'disabledSports': ('nfl',),
                     'disabledFinderSports': site_controls.FINDER_SPORTS}
    for field, allowed in allowed_lists.items():
        if not isinstance(policy.get(field), list) or not all(isinstance(v, str) for v in policy[field]):
            raise ValueError('Saved visibility lists must be explicit; defaults are not a backup')
        if any(v not in allowed for v in policy[field]):
            raise ValueError('Invalid saved visibility list')
    if not isinstance(rules, dict) or not isinstance(rules.get('rules'), dict):
        raise ValueError('Invalid member rules')
    # Apply the same member-rule validation used by the admin, without changing
    # the original bytes/updated timestamps of the imported record.
    import site_members
    for email, rule in rules['rules'].items():
        if site_members.normalize_email(email) != email or not isinstance(rule, dict):
            raise ValueError('Invalid member rule identity')
        site_members.validate_rule(rule)
    return entries


def _literal(value):
    # PostgreSQL standard-conforming strings, no dynamic identifiers.
    if '\x00' in value:
        raise ValueError('PostgreSQL cannot import NUL characters')
    return "'" + value.replace("'", "''") + "'"


def import_sql(backup, *, policy_confirmed=False, now=None):
    if not policy_confirmed:
        raise ValueError('Review and confirm the original visibility policy before preparing an import')
    entries = validate_backup(backup)
    now = time.time() if now is None else now
    lines = ["begin;", "set local standard_conforming_strings = on;",
             "select pg_advisory_xact_lock(726340021);",
             "do $$ begin if exists(select 1 from website_private.storage) or exists(select 1 from website_private.migration where ready) then raise exception 'Destination must be empty and not ready'; end if; end $$;"]
    for entry in entries:
        expiry = entry.get('expiresAt')
        if expiry is not None and expiry <= now:
            continue  # Never extend old leases, session replays or rate windows.
        value = entry['value']
        if entry['kind'] == 'string':
            value = store._pack(value)
        elif entry['kind'] == 'hash':
            value = {k: store._pack(v) for k, v in value.items()}
        elif entry['kind'] == 'list':
            value = [store._pack(v) for v in value]
        encoded = json.dumps(value, separators=(',', ':'), ensure_ascii=False)
        sql_expiry = 'null' if expiry is None else f'to_timestamp({float(expiry)!r})'
        lines.append('insert into website_private.storage(key,kind,value,expires_at) values (' +
                     ','.join((_literal(entry['key']), _literal(entry['kind']), _literal(encoded) + '::jsonb', sql_expiry)) + ');')
    # Keep the source lock if longer; enforce a fresh 15-minute safety window
    # before PIN sign-in can resume on a different shared counter store.
    lines.append("insert into website_private.storage values ('vortex_v2:admin_pin_lock_until','string',to_jsonb((extract(epoch from statement_timestamp())+900)::text),null) on conflict(key) do update set value=to_jsonb(greatest((website_private.storage.value #>> '{}')::double precision,extract(epoch from statement_timestamp())+900)::text),expires_at=null;")
    lines.append("update website_private.migration set ready=true, source=" + _literal(SOURCE) + ", verified_at=statement_timestamp() where id;")
    lines.extend(['commit;', ''])
    return '\n'.join(lines)


def export_backup(*, writers_paused=False):
    if not writers_paused or store.STORAGE_BACKEND != 'upstash' or store.KV_URL.rstrip('/') != SOURCE:
        raise ValueError('Export requires the original Upstash backend and paused writers')
    store.require_configured()
    keys = set(); cursor = '0'
    while True:
        reply = store.pipeline([['SCAN', cursor, 'COUNT', 100]])[0]['result']
        cursor, page = str(reply[0]), reply[1]
        keys.update(page)
        if cursor == '0':
            break
    entries = []
    for key in sorted(keys):
        kind = store.pipeline([['TYPE', key]])[0]['result']
        if kind == 'none':
            continue
        read = {'string': ['GET', key], 'hash': ['HGETALL', key], 'list': ['LRANGE', key, 0, -1],
                'zset': ['ZRANGE', key, 0, -1, 'WITHSCORES']}.get(kind)
        if read is None:
            raise ValueError('Unsupported source key type; export aborted')
        at = time.time()
        reply = store.pipeline([read, ['PTTL', key]])
        value, ttl = reply[0]['result'], reply[1]['result']
        if ttl == -2:
            continue
        if kind == 'hash':
            value = dict(zip(value[::2], value[1::2])) if isinstance(value, list) else value
        elif kind == 'zset':
            value = {name: float(score) for name, score in zip(value[::2], value[1::2])}
        entries.append({'key': key, 'kind': kind, 'value': value,
                        'expiresAt': None if ttl == -1 else at + ttl / 1000})
    backup = {'version': 1, 'source': SOURCE, 'complete': True, 'writersPaused': True,
              'capturedAt': time.time(), 'entries': entries}
    validate_backup(backup)
    return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('inspect', 'prepare-import', 'export'))
    parser.add_argument('path', type=Path, help='Private backup input, or new export output')
    parser.add_argument('--output', type=Path, help='New private SQL output; existing files are never overwritten')
    parser.add_argument('--confirm-original-policy', action='store_true')
    parser.add_argument('--source-writers-paused', action='store_true')
    args = parser.parse_args()
    if args.action == 'export':
        # Reserve the output before making network requests; remove no files.
        with args.path.open('x', encoding='utf-8') as handle:
            json.dump(export_backup(writers_paused=args.source_writers_paused), handle)
        print('Private backup exported. No source data was changed.')
        return
    backup = json.loads(args.path.read_text(encoding='utf-8'))
    entries = validate_backup(backup)
    print(f'Validated {len(entries)} records. Values and member details are not displayed.')
    if args.action == 'prepare-import':
        if args.output is None:
            parser.error('--output is required')
        sql = import_sql(backup, policy_confirmed=args.confirm_original_policy)
        with args.output.open('x', encoding='utf-8') as handle:
            handle.write(sql)
        print('Private SQL prepared. Nothing was uploaded or deployed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, store.StorageUnavailable):
        # Inputs may contain secrets. Never echo failed values or provider URLs.
        sys.exit('Migration preparation stopped. Check source access, backup format, policy approval and output path.')
