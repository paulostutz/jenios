/** B294 offline envelope audit for authenticated private-runner messages.
 * Authenticates bridge messages, not actual runtime bytes or broker events.
 */
import {verifyPrivateModeEnvelope,comparePrivateModeEnvelopes} from '../private-core-bridge.mjs';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function inspectB294AuthenticatedPrivateTriplet(envelopes,{secret,now=Date.now()}={}){
 if(!Array.isArray(envelopes)||envelopes.length!==3)
 fail('B294_THREE_ENVELOPES_REQUIRED');
 const verified=envelopes.map(x=>verifyPrivateModeEnvelope(x,{secret,now}));
 if(verified.some(x=>!x.valid))fail('B294_AUTHENTICATION_FAILED');
 const compared=comparePrivateModeEnvelopes(verified);
 if(!compared.valid)fail('B294_UNMATCHED_PRIVATE_CONTEXT');
 return Object.freeze({schema:'JENIOS_B294_AUTHENTICATED_PRIVATE_TRIPLET_V1',
  modeSides:compared.sideByMode,asset:verified[0].asset,
  observationSha256:compared.sharedObservationSha256,
  authenticatedMessages:true,privateRuntimeLoaded:false,
  executableBytesAttested:false,actualSignalDeliveryVerified:false,
  operatorOrderFeedVerified:false,liveBrokerConnection:false,
  ordersSent:0,performanceCertified:false});
}
