import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceRequestError} from '../src/storage-retry.js';

test('storage cooldown follows bounded server guidance',()=>{
 const error=serviceRequestError({error:'Storage limit reached',code:'storage_capacity',retryAfter:120});
 assert.equal(error.message,'Storage limit reached');assert.equal(error.retryAfter,120);
 assert.equal(serviceRequestError({code:'storage_capacity',retryAfter:999999}).retryAfter,300);
});
test('missing or invalid cooldown has a safe default',()=>{
 for(const retryAfter of [undefined,0,-1,'invalid',Infinity])assert.equal(serviceRequestError({code:'storage_unavailable',retryAfter}).retryAfter,15);
 assert.equal(serviceRequestError({code:'storage_unavailable'},'60').retryAfter,60);
});
test('unprepared migration uses the same bounded storage cooldown',()=>{
 const error=serviceRequestError({code:'storage_migration_pending',retryAfter:60});
 assert.equal(error.code,'storage_migration_pending');assert.equal(error.retryAfter,60);
});
test('unrelated failures cannot trigger storage cooldown',()=>{
 assert.equal(serviceRequestError({error:'Incorrect password',retryAfter:120}).retryAfter,undefined);
 assert.equal(serviceRequestError({code:'unknown',retryAfter:120}).retryAfter,undefined);
});
