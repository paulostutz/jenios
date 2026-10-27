/** R80: fail-closed private PAPER safety gate. No broker transport, no public route.
 * Durable state is read from the trusted service-role repository on every attempt.
 * A missing, stale, revoked or paused state blocks execution, including after restart.
 */
import {units,SCALE} from '../pilot-prep/contracts.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const deny=code=>{throw Object.assign(new Error(code),{code});};
export async function requireR80PaperSafety({ownerUserId,connectionId,clientOrderId,nowMs,order},
 {store,env=process.env}={}){
 if(env.VERCEL_ENV!=='preview'||env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED!=='true'||
    env.JENIOS_PRIVATE_PAPER_EXECUTOR!=='true')deny('R80_PAPER_DISABLED');
 if(!UUID.test(ownerUserId||'')||!UUID.test(connectionId||'')||
    typeof clientOrderId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(clientOrderId)||
    !Number.isSafeInteger(nowMs)||nowMs<=0||!order||
    order.clientOrderId!==clientOrderId||order.side!=='buy')deny('R80_INVALID_SCOPE');
 let notional;
 try{notional=units(order.quantity)*units(order.entry)/SCALE;}catch{deny('R80_PAPER_NOTIONAL_INVALID');}
 if(notional<=0n)deny('R80_PAPER_NOTIONAL_INVALID');
 if(!store||typeof store.readSafety!=='function')deny('R80_DURABLE_SAFETY_REQUIRED');
 let state;
 try{state=await store.readSafety({ownerUserId,connectionId,clientOrderId});}
 catch{deny('R80_DURABLE_SAFETY_UNAVAILABLE');}
 if(!state||state.ownerUserId!==ownerUserId||state.connectionId!==connectionId||
    state.status!=='ACTIVE'||state.killSwitchEngaged!==false||
    state.paperConsentEnabled!==true||state.liveExecutionEnabled!==false||
    state.approvalSource!=='PLATFORM_OWNER_SERVER_VERIFIED'||
    !Number.isSafeInteger(state.riskApprovedAtMs)||state.riskApprovedAtMs>nowMs||
    !Number.isSafeInteger(state.riskExpiresAtMs)||state.riskExpiresAtMs<=nowMs||
    typeof state.maxNotionalUnits!=='string'||
    !/^[1-9][0-9]{0,25}$/.test(state.maxNotionalUnits)||
    !Number.isSafeInteger(state.checkedAtMs)||state.checkedAtMs>nowMs+5000||
    nowMs-state.checkedAtMs>30000||notional>BigInt(state.maxNotionalUnits))
    deny('R80_PAPER_SAFETY_NOT_CONFIRMED');
 return Object.freeze({paperOnly:true,liveExecution:false,ownerUserId,connectionId,
   checkedAtMs:state.checkedAtMs,autoResubmitAllowed:false});
}
