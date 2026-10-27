/** R79 — server-only Supabase Postgres atomic PAPER approval store.
 * Requires Platform service-role client in a trusted private worker.
 * Never constructs credentials, issues approvals, places orders or exposes HTTP routes.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function checkedScope(value){
 if(!value||!UUID.test(value.approvalId||'')||
  !UUID.test(value.ownerUserId||'')||!UUID.test(value.connectionId||'')||
  !ID.test(value.clientOrderId||'')||!SHA.test(value.permitSha256||'')||
  !Number.isSafeInteger(value.expiresAtMs)||value.expiresAtMs<=0)
  fail('R79_APPROVAL_SCOPE_INVALID');
 return value;
}
/** Supabase .rpc() is one Postgres transaction. The SQL UPDATE uses row locks
 * and re-evaluates status after a concurrent claimant releases the lock.
 * No SELECT-before-UPDATE race is permitted.
 */
export function createR79PaperApprovalStore(db){
 if(!db||typeof db.rpc!=='function')fail('R79_PRIVATE_DATABASE_REQUIRED');
 return Object.freeze({
  async claimApprovedForExecution(checked){
   const scope=checkedScope(checked);
   let data,error;
   try{
    ({data,error}=await db.rpc('jenios_r79_claim_paper_approval',{
     p_approval_id:scope.approvalId,
     p_owner_user_id:scope.ownerUserId,
     p_connection_id:scope.connectionId,
     p_client_order_id:scope.clientOrderId,
     p_permit_sha256:scope.permitSha256,
     p_expires_at:new Date(scope.expiresAtMs).toISOString()
    }));
   }catch{fail('R79_PRIVATE_DATABASE_UNAVAILABLE');}
   if(error||!Array.isArray(data)||data.length>1)fail('R79_PRIVATE_DATABASE_UNAVAILABLE');
   if(data.length===0)return null;
   const row=data[0],usedAtMs=Date.parse(row?.used_at||''),
    expirationMs=Date.parse(row?.expires_at||'');
   // A malformed database result never becomes an approval.
   if(!Number.isFinite(usedAtMs)||!Number.isFinite(expirationMs)||
    expirationMs!==scope.expiresAtMs||
    row?.status!=='CLAIMED'||row.revoked_at!==null||
    row.approval_id!==scope.approvalId||
    row.owner_user_id!==scope.ownerUserId||
    row.connection_id!==scope.connectionId||
    row.client_order_id!==scope.clientOrderId||
    row.permit_sha256!==scope.permitSha256||
    row.source!=='PLATFORM_AUTH_SERVER_VERIFIED')
    fail('R79_CLAIM_RECEIPT_INVALID');
   return Object.freeze({
    approvalId:row.approval_id,ownerUserId:row.owner_user_id,
    connectionId:row.connection_id,clientOrderId:row.client_order_id,
    permitSha256:row.permit_sha256,expiresAtMs:expirationMs,
    status:'CLAIMED',usedAtMs,revokedAt:null,source:row.source
   });
  },
  /** Caller must authenticate Platform owner on the server before invoking.
   * This only revokes an unconsumed approval; it never cancels broker orders.
   */
  async revokePending(approvalId,verifiedOwnerUserId){
   if(!UUID.test(approvalId||'')||!UUID.test(verifiedOwnerUserId||''))
    fail('R79_APPROVAL_SCOPE_INVALID');
   let data,error;
   try{({data,error}=await db.rpc('jenios_r79_revoke_paper_approval',{
    p_approval_id:approvalId,p_owner_user_id:verifiedOwnerUserId
   }));}catch{fail('R79_PRIVATE_DATABASE_UNAVAILABLE');}
   if(error||typeof data!=='boolean')fail('R79_PRIVATE_DATABASE_UNAVAILABLE');
   return Object.freeze({revoked:data,brokerOrdersCancelled:false,liveExecution:false});
  }
 });
}
