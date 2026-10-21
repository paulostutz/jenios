import test from 'node:test';import assert from 'node:assert/strict';
import {assessCustomerBrokerLink} from '../lib/platform/launch/b221-customer-link-check.mjs';
const ownerId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',other='50b85e9d-339c-4d32-b2bf-82c467673832';const nowMs=1792530000000;
const connection={user_id:ownerId,provider:'alpaca',environment:'paper',status:'active',serverRoleFetched:true,
 identity_verified:true,last_sync_at:new Date(nowMs-1000).toISOString()};
test('B221 server-scoped read-only link is not execution authority',()=>{let r=assessCustomerBrokerLink({ownerId,verifiedSessionOwnerId:ownerId,provider:'alpaca',connection,nowMs});assert.equal(r.authenticatedReadOnlyClaim,true);assert.equal(r.paperExecutionCertified,false);assert.equal(r.credentialsExposed,false);});
test('B221 blocks cross-tenant scope and revoked account',()=>{
 assert.throws(()=>assessCustomerBrokerLink({ownerId,verifiedSessionOwnerId:other,provider:'alpaca',connection,nowMs}),/B221_AUTHENTICATED_OWNER_REQUIRED/);
 assert.throws(()=>assessCustomerBrokerLink({ownerId,verifiedSessionOwnerId:ownerId,provider:'alpaca',connection:{...connection,status:'revoked'},nowMs}),/B221_OWNER_ACCOUNT_SCOPE_MISMATCH/);
});
test('B221 guide-only provider cannot claim authenticated account',()=>{let r=assessCustomerBrokerLink({ownerId,verifiedSessionOwnerId:ownerId,provider:'ctrader',nowMs});assert.equal(r.authenticatedReadOnlyClaim,false);});
