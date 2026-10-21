/** B237: exercise the unchanged verified-person ledger via injected QA stubs only. */
import {grantVerifiedPersonTrial} from '../trial/person-ledger.mjs';
export async function exerciseSandboxTrial({user,verificationToken,verifyIdentity,db,secret,nowMs}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||typeof verifyIdentity!=='function'||!db?.rpc)
  throw Error('B237_ISOLATED_QA_DEPENDENCIES_REQUIRED');
 const outcome=await grantVerifiedPersonTrial({user,verificationToken,verifyIdentity,db,secret,now:()=>nowMs});
 return Object.freeze({schema:'JENIOS_B237_TRIAL_QA',
  state:outcome.status,eligible:outcome.eligible===true,trialDays:7,
  // No identity, hash, verification token, date of birth or credentials leave this module.
  paymentCreated:false,chargeCreated:false,entitlementGrantedByThisAudit:false});
}
