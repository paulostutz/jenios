/** B300 externally hosted read-only witness. Never echoes response bodies. */
import {probeB300HostedPreview,B300_PINNED_PREVIEW}
 from '../../lib/platform/qa/b300-hosted-readonly-probe.mjs';
try{
 const result=await probeB300HostedPreview();
 console.log('B300_HOSTED_READONLY_PASS '+JSON.stringify({
  origin:B300_PINNED_PREVIEW,checks:result.observedGetRequests,
  publicAndUnauthenticatedChecked:result.allExpectedStatusesObserved,
  platformCatalog:result.platformCatalog,
  university:result.socialCatalog,
  realSessionsCertified:false,integratedReleaseCertified:false
 }));
}catch(e){
 console.error('B300_HOSTED_READONLY_NO_GO '+JSON.stringify({
  code:typeof e?.code==='string'&&e.code.startsWith('B300_')?e.code:'B300_UNVERIFIED',
  automatedReleaseAllowed:false,externalOrdersAllowed:false
 }));
 process.exitCode=2;
}
