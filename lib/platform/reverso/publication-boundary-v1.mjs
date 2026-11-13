import {createReversoRuntimeSource} from './runtime-source.mjs';
import {createReversoSubscriptionRuntimeSourceV2} from './subscription/runtime-source-v2.mjs';

// REVPUB001 publishes information and authenticated unavailable states only.
// Hosted deployments must never forward a Reverso request to an unqualified
// financial producer, including when an old environment flag is still set.
export const REVERSO_WEB_PUBLICATION_V1 = Object.freeze({
  version: 'REVPUB001',
  webInformationPublished: true,
  realFinancialSourceQualified: false,
  productiveSubscriptionEnabled: false,
  realBillingAllowed: false,
  realDebitAuthorized: false,
  actualExecutionAuthorized: false,
});

const hosted = env => env?.VERCEL === '1' ||
  typeof env?.VERCEL_ENV === 'string' && env.VERCEL_ENV.length > 0;
const unavailable = async () => null;

export function createReversoPublishedStateSource({env = {}, ...options} = {}) {
  return hosted(env) ? unavailable : createReversoRuntimeSource({env, ...options});
}

export function createReversoPublishedSubscriptionSource({env = {}, ...options} = {}) {
  return hosted(env) ? unavailable : createReversoSubscriptionRuntimeSourceV2({env, ...options});
}
