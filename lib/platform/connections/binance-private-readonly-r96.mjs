/** JENIOS R96 — owner-authenticated Binance Spot TESTNET observation.
 * Reuses B165 vault, B167 service-only connection store and B166 official GETs.
 * Not a worker runner, public route, order sender or trading authorization.
 */
import {demoStore} from './demo-store.mjs';
import {decryptDemo,digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_.-]{20,4096}$/;
const HEX=/^[a-f0-9]{64}$/;
const KEY=/^[A-Za-z0-9_+/=-]{16,256}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};

function privateReadGate(env){
 if(env.VERCEL==='1'||env.VERCEL_ENV==='production'||
    env.JENIOS_R96_PRIVATE_NODE_WORKER!=='true'||
    env.JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED!=='true'||
    env.JENIOS_DEMO_CONNECTORS_ENABLED!=='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='false'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='false'||
    env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='false'||
    env.JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PAY_PAYMENTS_ENABLED!=='false')
   deny('R96_PRIVATE_BINANCE_READ_DISABLED');
 if(!vaultReady(env))deny('R96_DEMO_VAULT_REQUIRED');
}
async function principal(db,accessToken){
 if(!db?.auth?.getUser||typeof db.from!=='function'||
    typeof accessToken!=='string'||!TOKEN.test(accessToken))
   deny('R96_PLATFORM_AUTH_REQUIRED');
 let response;
 try{response=await db.auth.getUser(accessToken);}
 catch{deny('R96_PLATFORM_AUTH_REQUIRED');}
 const u=response?.data?.user;
 if(response?.error||!UUID.test(u?.id||'')||
    u.is_anonymous===true||!u.email_confirmed_at)
   deny('R96_PLATFORM_AUTH_REQUIRED');
 return u.id;
}
function verifiedConnection(row,owner,connectionId,nowMs){
 if(!row||row.id!==connectionId||row.user_id!==owner||
    row.provider!=='binance'||row.environment!=='testnet'||
    row.status!=='active'||row.identity_verified!==true||
    row.revoked===true||!HEX.test(row.external_digest||'')||
    !Number.isFinite(Date.parse(row.last_sync_at||''))||
    !Number.isFinite(Date.parse(row.created_at||''))||
    Date.parse(row.created_at)>nowMs||Date.parse(row.last_sync_at)>nowMs||
    nowMs-Date.parse(row.last_sync_at)>300000)
   deny('R96_TESTNET_ACCOUNT_NOT_VERIFIED');
 return row;
}
/** Input never accepts an ownerId or broker account ID.
 * No database writes or secret-bearing return values are permitted.
 */
export async function inspectR96BinanceTestnet({
 accessToken,connectionId
},{db,env=process.env,clock=Date.now,fetcher=fetch,reader=readDemoBroker}={}){
 privateReadGate(env);
 if(!UUID.test(connectionId||'')||typeof reader!=='function'||
    typeof fetcher!=='function')deny('R96_PRIVATE_DEPENDENCIES_REQUIRED');
 const owner=await principal(db,accessToken);
 const nowMs=clock();
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('R96_CLOCK_INVALID');
 let row;
 try{row=await demoStore(db).findById(owner,connectionId);}
 catch{deny('R96_CONNECTION_UNAVAILABLE');}
 const connection=verifiedConnection(row,owner,connectionId,nowMs);
 let credentials;
 try{credentials=decryptDemo(connection.credential_box,{
   userId:owner,id:connectionId,provider:'binance',
   environment:'testnet',kind:'credentials'
  },env);}
 catch{deny('R96_CREDENTIAL_VAULT_UNAVAILABLE');}
 if(!KEY.test(credentials?.apiKey||'')||!KEY.test(credentials?.secret||''))
   deny('R96_PRIVATE_CREDENTIAL_FORMAT');
 let observed;
 try{observed=await reader({
   provider:'binance',environment:'testnet',
   apiKey:credentials.apiKey,secret:credentials.secret
  },{now:()=>nowMs,fetcher});}
 catch{deny('R96_OFFICIAL_TESTNET_READ_UNAVAILABLE');}
 if(observed?.identityVerified!==true||
    observed.snapshot?.provider!=='binance'||
    observed.snapshot?.environment!=='testnet'||
    observed.snapshot?.complete!==true||
    observed.snapshot?.accountReadConfirmed!==true||
    observed.snapshot?.observedAtMs!==nowMs||
    observed.observation?.summary?.status!=='SPOT_TESTNET'||
    !Array.isArray(observed.snapshot.positions)||
    !Array.isArray(observed.snapshot.openOrders))
   deny('R96_TESTNET_ACCOUNT_READ_UNVERIFIED');
 let digest;
 try{digest=digestDemoAccount(observed.accountRef,{
   userId:owner,provider:'binance',environment:'testnet'
  },env);}
 catch{deny('R96_TESTNET_IDENTITY_UNAVAILABLE');}
 if(digest!==connection.external_digest)deny('R96_TESTNET_ACCOUNT_CHANGED');
 return Object.freeze({
  schema:'JENIOS_R96_BINANCE_SPOT_TESTNET_READONLY_V1',
  provider:'binance',environment:'testnet',readOnly:true,
  accountIdentityVerified:true,accountReadConfirmed:true,
  spotBalanceAssetCount:observed.snapshot.positions.length,
  openOrderCount:observed.snapshot.openOrders.length,
  spotBalancesNotFuturesPositions:true,
  tradingPermissionsCertified:false,
  stopOcoProtectionCertified:false,
  customerConsentForOrders:false,
  providerOrderReceiptsCertified:false,
  liveExecution:false,testnetOrderExecution:false,
  ordersSent:0,custody:false,withdrawals:false,
  requiresIndependentBrokerReview:true
 });
}
