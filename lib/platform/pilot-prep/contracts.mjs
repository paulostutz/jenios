/** B149 — non-custodial rehearsal contracts. No secret intake or live order transport. */
import {createHash} from 'node:crypto';
export const SCALE=100000000n;
export const MODES=Object.freeze(['direct','reverse','hybrid']);
export const BASE_COMMIT='4559d2ace3ac0cd4c95db55c67b7a7b671dece31';
export const CORE_SHA=Object.freeze({engine:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',service:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be'});
export function deny(code){throw Object.assign(new Error(code),{code});}
export function insist(ok,code){if(!ok)deny(code);}
export function record(x,keys){insist(x&&typeof x==='object'&&!Array.isArray(x),'OBJECT_REQUIRED');insist(Object.keys(x).every(k=>keys.includes(k)),'UNKNOWN_FIELD');return x;}
export function id(x){insist(typeof x==='string'&&/^[a-zA-Z0-9:._-]{1,100}$/.test(x),'INVALID_ID');return x;}
export function time(x){insist(Number.isSafeInteger(x)&&x>=0&&x<=8640000000000000,'INVALID_TIME');return x;}
export function uint(x,max=Number.MAX_SAFE_INTEGER){insist(Number.isSafeInteger(x)&&x>=0&&x<=max,'INVALID_INTEGER');return x;}
export function units(x){
 insist(typeof x==='string'&&/^(0|[1-9]\d{0,15})(\.\d{1,8})?$/.test(x),'DECIMAL_STRING_REQUIRED');
 const [a,b='']=x.split('.');return BigInt(a)*SCALE+BigInt(b.padEnd(8,'0'));
}
export function decimal(x){insist(typeof x==='bigint'&&x>=0n,'UNSIGNED_UNITS_REQUIRED');const f=(x%SCALE).toString().padStart(8,'0').replace(/0+$/,'');return (x/SCALE).toString()+(f?'.'+f:'');}
export function ceilDiv(a,b){insist(a>=0n&&b>0n,'INVALID_DIVISION');return (a+b-1n)/b;}
export function canonical(x){
 if(x===null||typeof x!=='object')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
export const digest=x=>createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
export function assertSessionOwner(session,connection){
 record(session,['userId','authenticated','diagnosticCompleted']);id(session.userId);
 record(connection,['id','userId','provider','accountId','environment','permissions','revoked','ownershipConfirmedAtMs']);
 for(const k of ['id','userId','accountId'])id(connection[k]);
 insist(session.authenticated===true&&session.userId===connection.userId,'ACCOUNT_OWNER_MISMATCH');
 insist(['ctrader','kraken-futures'].includes(connection.provider),'PROVIDER_NOT_SUPPORTED');
 insist(['paper','demo','live'].includes(connection.environment),'INVALID_ENVIRONMENT');
 insist(connection.revoked===false,'CONNECTION_REVOKED');time(connection.ownershipConfirmedAtMs);
 insist(Array.isArray(connection.permissions)&&connection.permissions.length>0&&connection.permissions.length<=2&&new Set(connection.permissions).size===connection.permissions.length&&connection.permissions.every(x=>['read','trade'].includes(x))&&connection.permissions.includes('read'),'UNSAFE_OR_UNKNOWN_PERMISSION');
 return connection;
}
export function assertRehearsal(session,connection){
 assertSessionOwner(session,connection);insist(connection.environment!=='live','LIVE_EXECUTION_DISABLED');
 return Object.freeze({environment:connection.environment,custody:'external_client_account',liveExecution:false,withdrawals:false});
}
export function instrument(input,now=Date.now()){
 record(input,['provider','id','marketType','base','quote','settlement','contractSize','qtyStep','minQty','maxQty','tickSize','capturedAtMs','sourceSha256','quantityUnit']);
 id(input.id);insist(['ctrader','kraken-futures','coinbase-exchange'].includes(input.provider),'PROVIDER_NOT_SUPPORTED');
 insist(['spot','linear','inverse'].includes(input.marketType),'INVALID_CONTRACT_TYPE');
 for(const k of ['base','quote','settlement'])insist(typeof input[k]==='string'&&/^[A-Z0-9]{2,12}$/.test(input[k]),'INVALID_CURRENCY');
 for(const k of ['contractSize','qtyStep','minQty','maxQty','tickSize'])insist(units(input[k])>0n,'NON_POSITIVE_CONTRACT_FIELD');
 insist(units(input.maxQty)>=units(input.minQty),'INVALID_QUANTITY_BOUNDS');
 insist(['base','contracts'].includes(input.quantityUnit),'INVALID_QUANTITY_UNIT');
 insist(input.marketType==='inverse'?input.settlement===input.base:input.settlement===input.quote,'SETTLEMENT_MISMATCH');
 time(now);time(input.capturedAtMs);insist(input.capturedAtMs<=now&&now-input.capturedAtMs<=86400000,'STALE_INSTRUMENT_METADATA');
 insist(/^[a-f0-9]{64}$/.test(input.sourceSha256),'SOURCE_HASH_REQUIRED');
 return structuredClone(input);
}
export function assertNoLiveTransport(){deny('LIVE_EXECUTION_DISABLED');}
