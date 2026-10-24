/** G45 approval record only. Importing this module never writes configuration,
 * enables generation/payments or changes any existing subscription/ledger. */
export const PRO_ALLOWANCE_APPROVAL_G45=Object.freeze({
 version:'G45-2026-10-24',approvedOn:'2026-10-24',retailMultiplier:2,
 warningPercent:80,
 plans:Object.freeze({
  'platform-global-crypto':Object.freeze({providerNanoUsd:2_000_000_000,retailNanoUsd:4_000_000_000}),
  'platform-internacional-pro':Object.freeze({providerNanoUsd:4_000_000_000,retailNanoUsd:8_000_000_000})
 }),
 additionalPackagePriceApproved:false
});
