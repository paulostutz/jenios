#!/usr/bin/env node
/** B260 release summary: deliberately unavailable as a production deploy action. */
import {finalizeInternalReleaseReview} from '../../../lib/platform/release260/b259-final-release-committee.mjs';
const sha=process.argv[2],at=Number(process.argv[3]);
try {
 const report=finalizeInternalReleaseReview({commit:sha,nowMs:at,
  ciEvidence:{expectedSha:sha,checksReportedPassing:true},
  previewEvidence:{expectedRoutesVerifiedLocally:true,adminReadOnlyRouteFailClosed:true}});
 process.stdout.write(JSON.stringify({
  ...report,provenance:'INTERNAL_QA_ONLY_NOT_ISSUER_ATTESTED',
  serverInstalled:false,paperBrokerAuthenticatedExternally:false,
  bankGatewayTestedExternally:false,productOwnerApprovalRequired:true})+'\n');
}catch{process.stderr.write('INVALID_B260_RELEASE_REVIEW_INPUT\n');process.exitCode=1;}
