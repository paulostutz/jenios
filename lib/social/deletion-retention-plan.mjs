/**
 * Read-only pre-erasure decision helper. NEVER deletes a Supabase user or data.
 * Financial obligations, audit trails and messaging FKs require human/legal review.
 */
const CRITICAL=new Set(['jenios_pay_orders','jenios_pay_subscriptions','jenios_pay_entitlements',
 'jenios_admin_audit','jenios_direct_messages_v7','jenios_direct_threads_v7']);
export function evaluateAccountErasure({accountId,foreignKeys,hasLegalHold=false}={}){
 if(typeof accountId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(accountId))
  return{executable:false,decision:'INVALID_ACCOUNT',manualReview:true};
 if(!Array.isArray(foreignKeys)||foreignKeys.some(x=>!x||typeof x.table!=='string'||typeof x.onDelete!=='string'))
  return{executable:false,decision:'DEPENDENCY_AUDIT_REQUIRED',manualReview:true};
 const blockers=foreignKeys.filter(x=>CRITICAL.has(x.table)||['NO ACTION','RESTRICT'].includes(x.onDelete))
  .map(x=>({table:x.table,onDelete:x.onDelete}));
 // Even when no FKs are known, no automated erasure is authorized by this preview.
 return{executable:false,decision:hasLegalHold?'LEGAL_HOLD':blockers.length?'RETENTION_REVIEW_REQUIRED':'HUMAN_APPROVAL_REQUIRED',
   manualReview:true,retentionCategories:[...new Set(blockers.map(x=>x.table))].sort(),verifiedAgainstLive:false};
}
