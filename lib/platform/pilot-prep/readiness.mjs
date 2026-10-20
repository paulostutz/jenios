/** B154 independent capabilities are not one completion percentage. This module never enables money. */
import {insist,record,digest,time,BASE_COMMIT} from './contracts.mjs';
export const REQUIRED=Object.freeze(['private_runtime','provider_approval','account_ownership','market_data_rights','contract_metadata','fees_and_funding','broker_reconciliation','protective_orders','prospective_original_core_evaluation','identity_and_diagnostic','operational_limits','separate_live_authorization']);
export function pilotReadiness(evidence,{now=Date.now(),expectedCommit=BASE_COMMIT}={}){
 time(now);insist(Array.isArray(evidence)&&evidence.length<=100,'INVALID_EVIDENCE');
 const accepted=new Map(),invalid=[];
 for(const row of evidence){
  try{
   record(row,['requirement','commit','artifactSha256','issuedAtMs','expiresAtMs','result','scope']);
   insist(REQUIRED.includes(row.requirement)&&row.commit===expectedCommit,'WRONG_SCOPE_OR_COMMIT');
   insist(/^[a-f0-9]{64}$/.test(row.artifactSha256)&&row.scope==='independently_reviewed','UNVERIFIED_EVIDENCE');
   time(row.issuedAtMs);time(row.expiresAtMs);insist(row.issuedAtMs<=now&&row.expiresAtMs>now&&row.expiresAtMs>row.issuedAtMs,'STALE_EVIDENCE');
   insist(row.result==='passed','EVIDENCE_NOT_PASSED');insist(!accepted.has(row.requirement),'DUPLICATE_REQUIREMENT');accepted.set(row.requirement,row);
  }catch(e){invalid.push(e.code||'INVALID_EVIDENCE');}
 }
 const missing=REQUIRED.filter(k=>!accepted.has(k));
 return {schema:'JENIOS_PILOT_PREPARATION_B154',assessment:missing.length||invalid.length?'NO_GO':'REQUIRES_MANUAL_INDEPENDENT_REVIEW',missing,invalid,records:accepted.size,evidenceDigest:digest(evidence),liveExecution:false,custody:false,reason:'Artifact hashes and labels do not authenticate an issuer or authorize execution. This preparation build has no live sender.'};
}
