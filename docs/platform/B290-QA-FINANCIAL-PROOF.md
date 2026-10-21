# JENIOS B290 — QA subscription proof and access verification

**Base B289:** QA-only financial tables and R26 learning state; CI GitHub 39660584637 SUCCESS.
**Database:** JENIOS Social homologacao `rebzztxlzofxpfwjvbee`. No user accounts or real payment entries created.

## What changed
Added `lib/assistant/verified-subscription-b290.mjs` read-only verification of payment evidence: subscription status active, correct user and product, latest paid order, provider Inter Pix, amount matching the approved plan, unique bank receipt E2E, matching txid, valid fiscal period and timestamps. The QA-only server flag `JENIOS_QA_STRICT_SUBSCRIPTION_PROOF=true` is required to activate it; production without that flag keeps original semantics.

Applied only to QA: `bank_end_to_end_id` nullable column, unique index, format check and explicit service-role write permission. It does NOT confirm a payment and does not expose new RPCs to the browser. No fake receipts or entitlements.

## Scenarios
Active plan without a confirmed bank-linked payment is denied by strict QA gate. National plan never gains advanced Gênios even with valid evidence. Paid global tiers require the correct bank-confirmed receipt. Pending, canceled, past due, future, expired, wrong amount, wrong user, wrong product, forged metadata or stale receipt all deny access.

## Limitations
The QA database has **0 users and 0 orders**: tests use local synthetic evidence and do not prove an authenticated customer has paid. The user's deferred Banco Inter certification remains pending. No real AI key, payment confirmation, order, broker execution or production deploy. Do not claim customer-facing Pro is live.

## Release
Preview B291 will enable the strict QA flag; production remains unchanged until a separately approved release. All protected research, Social, CHEFE and LETTER files remain untouched.
