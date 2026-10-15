import test from 'node:test';import assert from 'node:assert/strict';
import {createDirectService,messageBody} from '../lib/social/directService.mjs';
import {safeAppTarget,markNotificationRead} from '../lib/social/notifications.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('Direct rejects expired, different and anonymous accounts before database calls',async()=>{
 for(const user of [null,{id:'other'},{id,is_anonymous:true}]){const db={auth:{getUser:async()=>({data:{user}})},from(){throw Error('Database should not be called');}};await assert.rejects(createDirectService(db).threads(id),/Entre novamente/);}
});
test('Direct message limits and notification links prevent injected navigation',()=>{
 assert.equal(messageBody(' oi '),'oi');assert.throws(()=>messageBody(' '));assert.throws(()=>messageBody('x'.repeat(5001)));
 for(const url of ['https://evil.example','//evil.example','/\\evil.example','javascript:alert(1)'])assert.equal(safeAppTarget(url),null);
 assert.equal(safeAppTarget('/social?direct=1'),'/social?direct=1');
});
test('notification mark read requires the current owner',async()=>{
 await assert.rejects(markNotificationRead({auth:{getUser:async()=>({data:{user:{id:'other'}}})}},id,'notice'),/AUTH/);
});
