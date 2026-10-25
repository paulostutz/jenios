# G46 additional credits and integrated release

Prepared locally after Paulo requested this chat to finish the integration. Base e3411c4 preserves the already published G45, R44, PR6, University payment guard and its exact hosted release gate. G45 was confirmed installed in production as migration 20261024235145; do not apply it again. Only G46 remains to install. The other chat did not retain a recoverable G46 patch; this implementation is new and has its own evidence. Do not reuse its unverified test count.

Approved commercial table: provider capacity equivalent to BRL 5/10/20/50/100, sold for BRL 15/30/60/150/300. Official BCB PTAX converts capacity to integer nanoUSD; round down provider capacity before representing it as twice that amount in the historical ledger. The consumption multiplier remains 2x; the sale markup is 3x. No fixed number of tokens is promised.

Quotes bind owner, selected pack, version, FX, price and capacity. They remain immutable across retries, including lost responses. Switching the selected pack clears quotation and consent. Existing orders retain their exact snapshot. Only matching, confirmed bank receipts fund the wallet once. The legacy quote RPC is disabled by the new configuration's null single-package amount.

The global payment gate is checked before authentication, database access, FX and bank dispatch for all Pro credit endpoints. Both the general and Pro-specific gates remain necessary. G45 allowance migrations, historical usage, the 2x ledger, settlement functions, RLS and existing email/AI settings are preserved.

Migration prerequisites: G44/G45 installed, Pro payments paused. G46 configures only the approved catalog and nullable quote pack column; it never enables payment, generation, tariff approval or a SKU and never creates a subscription, payment, balance or usage. Replay is idempotent while paused. Use a reviewed backup and the hosted migration tool only after the disposable PostgreSQL suites pass. Never run test fixtures on hosted Supabase.

Real Platform billing and external broker execution remain outside this delivered adapter. An eligible legitimate subscription and tariff activation are still required for Pro use; no entitlement is fabricated to demonstrate functionality. Inter payment receipt/access activation must be homologated with the titular user before declaring commercial operation complete.
