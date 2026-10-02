// Local PostgreSQL semantics, not a live Supabase connection.
// See docs/supabase-storage-migration.md for the isolated test dependency.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

let PGlite;
try {
  ({ PGlite } = await import('../.storage-backups/sql-test-runtime/node_modules/@electric-sql/pglite/dist/index.js'));
} catch { /* Optional local test runtime, never a production dependency. */ }

test('private website storage migration and PostgreSQL commands', { skip: !PGlite }, async (t) => {
  const db = new PGlite();
  const pipeline = async (commands) => (await db.query('select public.website_storage_pipeline($1::jsonb) as result', [JSON.stringify(commands)])).rows[0].result.map(x => x.result);
  const asRole = async (role, fn) => {
    await db.exec(`set role ${role}`);
    try { return await fn(); } finally { await db.exec('reset role'); }
  };
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const schema = await readFile(new URL('../supabase/migrations/20261002_website_storage.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await t.test('unprepared destination refuses all operations', async () => {
      await assert.rejects(pipeline([['GET','x']]), /website_storage_not_ready/);
    });
    const fixture = execFileSync(process.env.PYTHON_FOR_STORAGE_TEST || 'python', ['tests/storage_migration_fixture.py'], { encoding:'utf8', env: {...process.env, WEBSITE_STORAGE_BACKEND:'upstash'} });
    await db.exec(fixture);
    await t.test('import preserves hashes lists sorted sets and absolute expiries', async () => {
      const [hash, list, zset, ttl, missing] = await pipeline([['HGETALL','hash'],['LRANGE','moves',0,-1],['ZRANGEBYSCORE','players',0,'+inf'],['PTTL','future'],['GET','expired']]);
      assert.equal(hash[0], "a'b\\x"); assert.ok(hash[1].startsWith('~kd-storage-v1:z:'));
      assert.deepEqual(list,['one','two']); assert.deepEqual(zset,['player']); assert.ok(ttl>0); assert.equal(missing,null);
    });
    await t.test('second import cannot overwrite restored records', async () => {
      await assert.rejects(db.exec(fixture), /Destination must be empty/);
      await db.exec('rollback');
    });
    await t.test('schema rerun preserves data and readiness', async () => {
      await db.exec(schema); assert.deepEqual(await pipeline([['GET','expired']]),[null]);
    });
    await t.test('anon and signed-in members cannot call storage or read private tables', async () => {
      for (const role of ['anon','authenticated']) {
        await assert.rejects(asRole(role,()=>pipeline([['GET','future']])), /permission denied/);
        await assert.rejects(asRole(role,()=>db.query('select * from website_private.storage')), /permission denied/);
        await assert.rejects(asRole(role,()=>db.query('select public.website_storage_pin_failure()')), /permission denied/);
      }
    });
    await t.test('server role can call only granted routines, not private tables', async () => {
      assert.deepEqual(await asRole('service_role',()=>pipeline([['GET','future']])),['lease']);
      await assert.rejects(asRole('service_role',()=>db.query('select * from website_private.storage')), /permission denied/);
    });
    await t.test('SET NX EX lease and compare-delete ownership', async () => {
      assert.deepEqual(await pipeline([['SET','lock','owner','NX','EX',20],['SET','lock','other','NX','EX',20]]),['OK',null]);
      assert.deepEqual(await pipeline([['COMPAREDEL','lock','other'],['GET','lock'],['COMPAREDEL','lock','owner'],['GET','lock']]),[0,'owner',1,null]);
    });
    await t.test('counters increment without extending an NX expiry', async () => {
      assert.deepEqual(await pipeline([['INCR','rate'],['EXPIRE','rate',900,'NX'],['INCR','rate'],['EXPIRE','rate',900,'NX']]),[1,1,2,0]);
      assert.deepEqual(await pipeline([['MGET','rate','absent']]),[['2',null]]);
    });
    await t.test('expired data disappears and NX can reclaim it', async () => {
      await db.query("insert into website_private.storage values('old','string','\"old\"',now()-interval '1 second')");
      assert.deepEqual(await pipeline([['GET','old'],['SET','old','new','NX'],['PTTL','old']]),[null,'OK',-1]);
    });
    await t.test('hashes return flat pairs and enforce first-write semantics', async () => {
      assert.deepEqual(await pipeline([['HSET','h','a','1','b','2'],['HSETNX','h','a','3'],['HSETNX','h','c','4'],['HLEN','h'],['HGET','h','a']]),[2,0,1,3,'1']);
      assert.deepEqual(await pipeline([['HGETALL','h'],['HDEL','h','b','c','absent'],['HLEN','h']]),[['a','1','b','2','c','4'],2,1]);
    });
    await t.test('list push, trim, and negative bounds match Redis', async () => {
      assert.deepEqual(await pipeline([['LPUSH','l','1','2','3'],['LRANGE','l',0,-1],['LTRIM','l',0,1],['LRANGE','l',-1,-1],['LLEN','l']]),[3,['3','2','1'],'OK',['2'],2]);
      assert.deepEqual(await pipeline([['LRANGE','l',5,7],['LTRIM','l',5,7],['LLEN','l']]),[[],'OK',0]);
    });
    await t.test('sorted-set updates and inclusive score ranges', async () => {
      assert.deepEqual(await pipeline([['ZADD','z',10,'a',20,'b'],['ZADD','z',30,'a'],['ZRANGEBYSCORE','z',20,'+inf']]),[2,0,['b','a']]);
    });
    await t.test('invalid batch rolls back earlier mutations', async () => {
      await assert.rejects(pipeline([['SET','rollback','x'],['UNKNOWN','x']]), /unsupported_command/);
      assert.deepEqual(await pipeline([['GET','rollback']]),[null]);
      await pipeline([['SET','wrong','text']]);
      await assert.rejects(pipeline([['HSET','wrong','a','b']]), /wrong_type/);
    });
    await t.test('five PIN failures lock globally; active locks are not shortened', async () => {
      await pipeline([['SET','vortex_v2:admin_pin_lock_until','0'],['SET','vortex_v2:admin_pin_fail_count','0']]);
      for (let i=0;i<5;i++) await db.query('select public.website_storage_pin_failure()');
      const [until,count] = await pipeline([['GET','vortex_v2:admin_pin_lock_until'],['GET','vortex_v2:admin_pin_fail_count']]);
      assert.ok(Number(until)>Date.now()/1000+890); assert.equal(count,'0');
      await db.query('select public.website_storage_pin_failure()');
      assert.deepEqual(await pipeline([['GET','vortex_v2:admin_pin_lock_until']]),[until]);
    });
    await t.test('missing policy fails closed even after readiness was confirmed', async () => {
      await pipeline([['DEL','krazy_data:site_controls:v1']]);
      await assert.rejects(pipeline([['GET','future']]), /website_storage_not_ready/);
    });
  } finally { await db.close(); }
});
