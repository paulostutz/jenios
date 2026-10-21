/** B295 fail-closed evidence checklist for a genuine isolated private runner.
 * No runner launched, no private source loaded, no broker calls.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export const B295_REQUIRED=Object.freeze([
 'runnerIsolated','privateExecutableHashVerified','runnerClockWitnessed',
 'threeOriginalModesObserved','signalsBeforeTarget','deliveryAcknowledged',
 'operatorFeedConsentVerified','riskB152GatesVerified',
 'noOrderTransport','noPaperOrderTransport','marketSourceIndependentlyVerified'
]);
export function assessB295PrivateRunnerProof(evidence={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))fail('B295_INVALID_EVIDENCE');
 const missing=B295_REQUIRED.filter(k=>evidence[k]!==true);
 const noGo=missing.length>0;
 return Object.freeze({schema:'JENIOS_B295_PRIVATE_RUNNER_ATTESTATION_GATE_V1',
  evidenceAccepted:!noGo,missing:Object.freeze(missing),
  noGoForFunctionalCertification:noGo,
  functionalThreeModesCertified:!noGo,
  privateCoreExecutedByThisModule:false,
  brokerOrdersSent:0,paperOrdersSent:0,
  noAutomaticDeployment:true,
  note:noGo?'Nenhuma prova funcional ponta a ponta certificada.':
  'Checklist preenchido; exige auditoria independente dos anexos antes de publicar alegacoes.'});
}
