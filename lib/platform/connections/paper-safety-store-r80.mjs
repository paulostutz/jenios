/** R80: trusted Platform service-role adapter for PAPER safety.
 * No web route and no secrets. Database time and owner-bound RPC are authoritative.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const UNITS=/^[1-9][0-9]{0,25}$/;
const deny=code=>{throw Object.assign(new Error(code),{code});};
const scope=({ownerUserId,connectionId})=>{
 if(!UUID.test(ownerUserId||'')||!UUID.test(connectionId||''))deny('R80_INVALID_SCOPE');
 return {p_owner_user_id:ownerUserId,p_connection_id:connectionId};
};
export function createR80PaperSafetyStore(db){
 if(typeof db?.rpc!=='function')deny('R80_PRIVATE_DATABASE_REQUIRED');
 return Object.freeze({
  async readSafety(input){
   let response;
   try{response=await db.rpc('jenios_r80_read_paper_safety',scope(input));}
   catch{deny('R80_PRIVATE_DATABASE_UNAVAILABLE');}
   if(response?.error||!Array.isArray(response?.data)||response.data.length>1)
    deny('R80_PRIVATE_DATABASE_UNAVAILABLE');
   if(response.data.length===0)return null;
   const row=response.data[0];
   const checkedAtMs=Date.parse(row?.checked_at||'');
   const riskApprovedAtMs=Date.parse(row?.risk_approved_at||'');
   const riskExpiresAtMs=Date.parse(row?.risk_expires_at||'');
   if(row?.owner_user_id!==input.ownerUserId||row?.connection_id!==input.connectionId||
      !['ACTIVE','PAUSED'].includes(row.status)||
      typeof row.kill_switch_engaged!=='boolean'||
      typeof row.paper_consent_enabled!=='boolean'||
      row.live_execution_enabled!==false||
      !Number.isSafeInteger(checkedAtMs)||checkedAtMs<=0||
      (row.max_notional_units!==null&&!UNITS.test(row.max_notional_units))||
      (row.risk_approved_at!==null&&!Number.isSafeInteger(riskApprovedAtMs))||
      (row.risk_expires_at!==null&&!Number.isSafeInteger(riskExpiresAtMs)))
     deny('R80_INVALID_SAFETY_RECEIPT');
   return Object.freeze({ownerUserId:row.owner_user_id,connectionId:row.connection_id,
    status:row.status,killSwitchEngaged:row.kill_switch_engaged,
    paperConsentEnabled:row.paper_consent_enabled,
    liveExecutionEnabled:false,checkedAtMs,
    maxNotionalUnits:row.max_notional_units,
    riskApprovedAtMs:row.risk_approved_at===null?null:riskApprovedAtMs,
    riskExpiresAtMs:row.risk_expires_at===null?null:riskExpiresAtMs,
    approvalSource:row.approval_source});
  },
  /** Caller must establish true Platform owner identity BEFORE invoking. */
  async engageKill({ownerUserId,connectionId}){
   let response;
   try{response=await db.rpc('jenios_r80_engage_paper_kill',
     scope({ownerUserId,connectionId}));}
   catch{deny('R80_PRIVATE_DATABASE_UNAVAILABLE');}
   if(response?.error||typeof response?.data!=='boolean')
     deny('R80_PRIVATE_DATABASE_UNAVAILABLE');
   return Object.freeze({paused:response.data,ordersCancelled:false,
     positionsClosed:false,liveExecution:false,
     claimedOrdersNeedBrokerReconciliation:true});
  }
 });
}
