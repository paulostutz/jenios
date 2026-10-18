# JENIOS S05 | Production readiness — B24

**State:** BLOCKED for full production deployment (18 October 2026).
**Baseline:** S02 production af86e69e5a0d5f344e89e2403210ff9fb5062315.
**Candidate:** release/jenios-s05-integrada-homologacao-20261018 (not promoted).

## Evidence
- S05 isolated preview d0b03db45aaaebbc1307a71744959de717c3741e: 333/333 S03/S04/S05 tests, zero failures, deployed READY.
- B18 selective release e294b8b151c0e1f2fbe591a80a79a3e7eeea271f: npm ci, 322 tests, Next 15.5.28 build and preview READY.
- Supabase staging rebzztxlzofxpfwjvbee has 8 social tables with RLS and transactional fake-user tests passed.
- Supabase production igayfjorjmucthlfoasf: read-only metadata check found no public.social_handle_availability_v1, social_signup_profile_v1, social_has_recent_auth_v1, or social_reopen_deletion_request_v1. No production migrations authorized/executed.
- Staging /social redirects to lab; this middleware must never be included in production.
- Real authenticated HTTP post persistence over separate sign-ins is not certified. No bypass of protected account provisioning.

## Mandatory next gates
1. Test two real, expressly authorized isolated staging sessions: signup/login, create/list/relogin, profile grid, comments/likes, archive, delete, blocked reads, exclusive @ and four availability suggestions.
2. Prepare audited production SQL migration plan with explicit approval for production only after backup, dry-run and RLS/security review; no automatic production DB mutations.
3. Create an integrated candidate without staging-only middleware and with BankScore/crypto detailed report free behind real Social profile, PDF validations, video fallback, deletion request safeguards; protect critical financial API SHA256 against the approved baseline.
4. npm ci, all existing S03/S04/S05 test suites, browser mobile/desktop, private media, PDF authorization negative tests and no real billing.
5. Production deploy only if 1–4 all pass, preserve rollback to S02; no merge to main.

## Non-negotiable
No production deploy before gates pass. Do not equate a READY preview with successful end-to-end certification. Do not change B52 private robot or BankScore/validator/PAY financial APIs. The user authorized a production release *conditional on complete proof*.
