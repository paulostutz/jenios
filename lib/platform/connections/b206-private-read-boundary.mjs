/** B206 — executable, isolated, GET-only Alpaca Paper observer boundary.
 * This is NOT a trading service. No public Next route imports it. A separate
 * human-initiated, narrowly scoped HMAC grant is required for each audit cycle.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {vaultReady} from './demo-vault.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const SHA=/^[0-9a-f]{64}$/;
const KEYS=['accountDigest','auditId','clientOrderId','connectionId','expiresAtMs','issuedAtMs','kind','operatorApproval','userId','v'];
function key(env){
 const raw=env?.JENIOS_PAPER_OBSERVER_KEY_B64;
 if(typeof raw!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(raw))deny('OBSERVER_SIGNING_KEY_REQUIRED');
 const b=Buffer.from(raw,'base64');
 if(b.length!==32||b.toString('base64')!==raw)deny('OBSERVER_SIGNING_KEY_REQUIRED');
 return b;
}
export function assertIsolatedReadWorker(env=process.env){
 if(!env||env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT!=='true'||
    env.JENIOS_PRIVATE_PAPER_READ_OBSERVER!=='true'||
    env.JENIOS_PRIVATE_PAPER_OBSERVER_WORKER!=='true'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED==='true'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR==='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED==='true'||!vaultReady(env))
   deny('PRIVATE_GET_ONLY_WORKER_DISABLED');
 key(env);
 return Object.freeze({provider:'alpaca',environment:'paper',method:'GET',
  isolated:true,externalPaperOrderSubmission:false,liveTrading:false,
  custodian:false,withdrawals:false,automaticRetry:false});
}
function validPayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!==KEYS.slice().sort().join(',')||
    p.v!==1||p.kind!=='ALPACA_PAPER_READ_ONLY'||
    p.operatorApproval!=='PRIVATE_MANUAL_READ_APPROVED'||
    !UUID.test(p.userId||'')||!UUID.test(p.connectionId||'')||
    !ID.test(p.clientOrderId||'')||!ID.test(p.auditId||'')||
    !SHA.test(p.accountDigest||'')||
    !Number.isSafeInteger(p.issuedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
    p.issuedAtMs<=0||p.expiresAtMs<=p.issuedAtMs||
    p.expiresAtMs-p.issuedAtMs>120000)deny('READ_GRANT_SCOPE_INVALID');
}
function sign(p,secret){
 return createHmac('sha256',secret).update('jenios-paper-read-only-20261021\0')
  .update(JSON.stringify(p)).digest('hex');
}
export function issuePrivatePaperReadGrant(payload,{env=process.env}={}){
 assertIsolatedReadWorker(env);validPayload(payload);
 const copy=Object.freeze({...payload});
 return Object.freeze({payload:copy,hmacSha256:sign(copy,key(env))});
}
export function verifyPrivatePaperReadGrant(grant,expected,{env=process.env,nowMs=Date.now()}={}){
 assertIsolatedReadWorker(env);
 if(!grant||Object.keys(grant).sort().join(',')!=='hmacSha256,payload'||
    !SHA.test(grant.hmacSha256||''))deny('READ_GRANT_INVALID');
 validPayload(grant.payload);
 if(!Number.isSafeInteger(nowMs)||nowMs<grant.payload.issuedAtMs||nowMs>=grant.payload.expiresAtMs)
  deny('READ_GRANT_EXPIRED');
 for(const field of ['userId','connectionId','accountDigest','clientOrderId','auditId'])
  if(grant.payload[field]!==expected?.[field])deny('READ_GRANT_CROSS_ACCOUNT');
 const expectedSig=Buffer.from(sign(grant.payload,key(env)),'hex');
 if(!timingSafeEqual(expectedSig,Buffer.from(grant.hmacSha256,'hex')))
  deny('READ_GRANT_SIGNATURE_INVALID');
 return Object.freeze({readOnlyGranted:true,validUntilMs:grant.payload.expiresAtMs,
  independentBrokerWitnessCertified:false,externalOrderAuthorized:false,liveExecution:false});
}
/** Second defense: the underlying broker reader already hardcodes these URLs.
 * One audit can perform only the 3 account GETs and up to 2 order GETs.
 */
export function createOfficialPaperGetBoundary(fetcher,{maxCalls=5}={}){
 if(typeof fetcher!=='function'||!Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>10)
  deny('INVALID_PRIVATE_FETCH_BOUNDARY');
 let calls=0;
 const allowed=(url,options)=>{
  if(typeof url!=='string'||url.length>512||!options||options.method!=='GET'||
     options.redirect!=='error'||options.cache!=='no-store')deny('PAPER_GET_ONLY_REQUIRED');
  let u;try{u=new URL(url);}catch{deny('PAPER_GET_URL_REJECTED');}
  if(u.protocol!=='https:'||u.host!=='paper-api.alpaca.markets'||u.username||u.password||u.hash)
   deny('UNAPPROVED_PAPER_BROKER_DESTINATION');
  if(['/v2/account','/v2/positions'].includes(u.pathname)&&!u.search)return true;
  if(u.pathname==='/v2/orders'&&u.searchParams.size===2&&
     u.searchParams.get('status')==='open'&&u.searchParams.get('limit')==='500')return true;
  if(u.pathname==='/v2/orders:by_client_order_id'&&u.searchParams.size===1&&
     ID.test(u.searchParams.get('client_order_id')||''))return true;
  deny('UNAPPROVED_PAPER_GET_PATH');
 };
 const wrapped=async(url,options)=>{
  allowed(url,options);
  if(++calls>maxCalls)deny('PAPER_READ_BUDGET_EXCEEDED');
  // Deliberately avoid logging the URL, headers, upstream errors or response.
  try{return await fetcher(url,options);}catch{deny('PAPER_OFFICIAL_GET_FAILED');}
 };
 Object.defineProperty(wrapped,'count',{get:()=>calls});
 return wrapped;
}
