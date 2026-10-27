/** R78 — server-only proof and single-use authorization. No public route, no broker call.
 * An approval object supplied by a browser is never a trading authorization.
 */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const HEX=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9._:-]{1,100}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=x=>JSON.stringify(x,Object.keys(x).sort());
function secret(env) {
 const s=env?.JENIOS_R78_APPROVAL_SIGNING_SECRET;
 if(typeof s!=='string'||!HEX.test(s))fail('R78_SIGNER_UNAVAILABLE');
 return Buffer.from(s,'hex');
}
function digest(body,key) {return createHmac('sha256',key).update(canonical(body)).digest('hex');}
function shape(record,now) {
 if(!record||typeof record!=='object'||Array.isArray(record)||
  record.scope!=='ALPACA_PAPER_APPROVAL_V1'||record.provider!=='alpaca'||
  record.environment!=='paper'||record.liveAccount!==false||
  !ID.test(record.ownerId||'')||!ID.test(record.connectionId||'')||
  !ID.test(record.clientOrderId||'')||!ID.test(record.nonce||'')||
  !/^[1-9][0-9]{0,25}$/.test(record.maxNotionalUnits||'')||
  !Number.isSafeInteger(record.issuedAtMs)||!Number.isSafeInteger(record.expiresAtMs)||
  record.issuedAtMs>now||record.expiresAtMs<=now||
  record.expiresAtMs-record.issuedAtMs>600000||
  typeof record.orderDigest!=='string'||!HEX.test(record.orderDigest))
   fail('R78_APPROVAL_INVALID');
 return record;
}
export function createR78Approval({ownerId,connectionId,clientOrderId,maxNotionalUnits,orderDigest,nowMs},
 {env=process.env,random=randomBytes}={}) {
 const key=secret(env);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('R78_CLOCK_REQUIRED');
 const record=shape({scope:'ALPACA_PAPER_APPROVAL_V1',provider:'alpaca',environment:'paper',liveAccount:false,
  ownerId,connectionId,clientOrderId,maxNotionalUnits,orderDigest,
  nonce:random(24).toString('hex'),issuedAtMs:nowMs,expiresAtMs:nowMs+300000},nowMs);
 return Object.freeze({record:Object.freeze(record),signature:digest(record,key)});
}
export function verifyR78Approval(proof,{ownerId,connectionId,clientOrderId,orderDigest,nowMs,env=process.env}={}) {
 const key=secret(env);
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('R78_CLOCK_REQUIRED');
 const record=shape(proof?.record,nowMs),signature=proof?.signature;
 if(typeof signature!=='string'||!HEX.test(signature)||
  record.ownerId!==ownerId||record.connectionId!==connectionId||
  record.clientOrderId!==clientOrderId||record.orderDigest!==orderDigest)
   fail('R78_APPROVAL_INVALID');
 const actual=digest(record,key);
 if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(actual,'hex')))fail('R78_SIGNATURE_MISMATCH');
 return Object.freeze({ownerId,connectionId,clientOrderId,nonce:record.nonce,
  maxNotionalUnits:record.maxNotionalUnits,expiresAtMs:record.expiresAtMs});
}
/** Store must atomically claim a nonce in a durable DB, keyed by owner, account and order.
 * This function intentionally has no default store, so absent infrastructure is NO_GO.
 */
export async function claimR78Approval(proof,scope,{store,env=process.env,nowMs}={}) {
 const verified=verifyR78Approval(proof,{...scope,env,nowMs});
 if(!store||typeof store.claimOnce!=='function')fail('R78_DURABLE_CLAIM_REQUIRED');
 let ok=false;
 try{ok=(await store.claimOnce(verified))===true;}catch{fail('R78_DURABLE_CLAIM_UNAVAILABLE');}
 if(!ok)fail('R78_APPROVAL_USED_OR_REVOKED');
 return Object.freeze({...verified,claimed:true,canTradeLive:false,externalPaperNotYetCertified:true});
}
