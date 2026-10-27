/** R78: offline-verifiable PAPER consent issued by a trusted Platform service.
 * Only private workers may invoke this; no browser route, account key or Live trading.
 * Both Ed25519 proof and a durable owner-consent record are REQUIRED.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';
import {units,SCALE} from '../pilot-prep/contracts.mjs';
import {requireR77PrivatePaperGate,submitAlpacaPaperOnce} from './alpaca-paper-private-transport-r77.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ORDER=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const EQUITY=/^[A-Z][A-Z0-9.]{0,14}$/;
const keys=['schema','approvalId','ownerUserId','connectionId','accountDigest','clientOrderId',
 'mode','side','symbol','maxNotionalUnits','issuedAtMs','expiresAtMs','environment'];
const fail=code=>{throw Object.assign(new Error(code),{code});};
const digest=body=>createHash('sha256').update(body).digest('hex');

/** Canonical string is purpose-separated and independent from JSON key ordering.
 * Only the separate trusted issuer holds the signing key; do not use Git/Vercel.
 */
export function canonicalR78PaperPermit(permit){
 if(!permit||typeof permit!=='object'||Array.isArray(permit)||
  Object.keys(permit).sort().join('|')!==keys.slice().sort().join('|')||
  permit.schema!=='JENIOS_R78_SIGNED_PAPER_PERMIT_V1'||
  !UUID.test(permit.approvalId||'')||!UUID.test(permit.ownerUserId||'')||
  !UUID.test(permit.connectionId||'')||!SHA.test(permit.accountDigest||'')||
  !ORDER.test(permit.clientOrderId||'')||!EQUITY.test(permit.symbol||'')||
  !['direct','reverse','hybrid'].includes(permit.mode)||permit.side!=='buy'||
  permit.environment!=='paper'||typeof permit.maxNotionalUnits!=='string'||
  !/^[1-9][0-9]{0,25}$/.test(permit.maxNotionalUnits)||
  !Number.isSafeInteger(permit.issuedAtMs)||permit.issuedAtMs<=0||
  !Number.isSafeInteger(permit.expiresAtMs)||permit.expiresAtMs<=permit.issuedAtMs||
  permit.expiresAtMs-permit.issuedAtMs>300000)fail('R78_INVALID_SIGNED_PERMIT');
 return 'JENIOS_R78_SIGNED_PAPER_APPROVAL_V1\n'+JSON.stringify(keys.map(k=>permit[k]));
}
function signerKey(env){
 const encoded=env?.JENIOS_R78_PAPER_APPROVAL_VERIFY_KEY;
 if(typeof encoded!=='string'||encoded.length>256||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
  fail('R78_APPROVAL_KEY_UNAVAILABLE');
 try{
  const der=Buffer.from(encoded,'base64');
  if(der.toString('base64')!==encoded)fail('R78_APPROVAL_KEY_UNAVAILABLE');
  const key=createPublicKey({key:der,format:'der',type:'spki'});
  if(key.asymmetricKeyType!=='ed25519')fail('R78_APPROVAL_KEY_UNAVAILABLE');
  return key;
 }catch{fail('R78_APPROVAL_KEY_UNAVAILABLE');}
}
export function verifyR78PaperPermit({permit,signature,session,storedConnection,order,nowMs},
 {env=process.env}={}){
 requireR77PrivatePaperGate(env);
 const body=canonicalR78PaperPermit(permit);
 if(!Number.isSafeInteger(nowMs)||nowMs<permit.issuedAtMs-1000||
  nowMs>=permit.expiresAtMs||!session||session.authenticated!==true||
  session.diagnosticCompleted!==true||
  session.userId!==permit.ownerUserId||
  !storedConnection||storedConnection.user_id!==permit.ownerUserId||
  storedConnection.id!==permit.connectionId||
  storedConnection.provider!=='alpaca'||storedConnection.environment!=='paper'||
  storedConnection.status!=='active'||storedConnection.revoked===true||
  storedConnection.external_digest!==permit.accountDigest||
  !order||order.clientOrderId!==permit.clientOrderId||
  order.symbol!==permit.symbol||order.mode!==permit.mode||order.side!==permit.side)
  fail('R78_WRONG_OWNER_ORDER_OR_EXPIRED');
 if(typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))
  fail('R78_SIGNATURE_INVALID');
 const bytes=Buffer.from(signature,'base64');
 if(bytes.length!==64||bytes.toString('base64')!==signature||
  !verify(null,Buffer.from(body,'utf8'),signerKey(env),bytes))
  fail('R78_SIGNATURE_INVALID');
 const notional=units(order.quantity)*units(order.entry)/SCALE;
 if(notional<=0n||notional>BigInt(permit.maxNotionalUnits))
  fail('R78_NOTIONAL_EXCEEDS_CONSENT');
 return Object.freeze({schema:permit.schema,approvalId:permit.approvalId,
  permitSha256:digest(body),ownerUserId:permit.ownerUserId,
  connectionId:permit.connectionId,clientOrderId:permit.clientOrderId,
  expiresAtMs:permit.expiresAtMs,notionalVerified:true,
  paperOnly:true,liveExecution:false});
}

/** A worker must supply a trusted server-side repository.
 * No approval is valid from a browser JSON, a self-reported boolean or a cache.
 * The B152 ledger remains the authoritative one-shot reservation.
 */
export async function submitSignedR78PaperOnce({permit,signature,...input},
 {approvalStore,ledger,env=process.env,paperExecutor=submitAlpacaPaperOnce,
  fetcher,reader}={}){
 const checked=verifyR78PaperPermit({permit,signature,session:input.session,
  storedConnection:input.storedConnection,order:input.order,nowMs:input.nowMs},{env});
 if(!approvalStore||typeof approvalStore.findApprovedById!=='function')
  fail('R78_DURABLE_CONSENT_REQUIRED');
 let saved;
 try{
  saved=await approvalStore.findApprovedById(checked.approvalId,checked.ownerUserId);
 }catch{fail('R78_DURABLE_CONSENT_UNAVAILABLE');}
 if(!saved||saved.status!=='APPROVED'||saved.revokedAt!==null||
  saved.usedAt!==null||saved.approvalId!==checked.approvalId||
  saved.ownerUserId!==checked.ownerUserId||
  saved.connectionId!==checked.connectionId||
  saved.clientOrderId!==checked.clientOrderId||
  saved.permitSha256!==checked.permitSha256||
  saved.expiresAtMs!==checked.expiresAtMs||
  saved.source!=='PLATFORM_AUTH_SERVER_VERIFIED')
  fail('R78_DURABLE_CONSENT_MISMATCH');
 const approval=Object.freeze({consent:'PAPER_TEST_ONLY',authorizedBy:permit.ownerUserId,
  connectionId:permit.connectionId,provider:'alpaca',environment:'paper',liveAccount:false,
  authorizedAtMs:permit.issuedAtMs,maxNotionalUnits:permit.maxNotionalUnits});
 const response=await paperExecutor({...input,approval},{ledger,env,fetcher,reader});
 if(!response||response.liveExecution!==false||response.paperOnly!==true||
  response.autoResubmitAllowed!==false)fail('R78_INVALID_PAPER_RECEIPT');
 return Object.freeze({...response,signedOwnerConsentVerified:true});
}
