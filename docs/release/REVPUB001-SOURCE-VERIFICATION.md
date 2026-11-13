# REVPUB001 — exact Web publication boundary

This successor starts from the exact REVFIN002 Web candidate
`d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a`, tree
`db07e4e6b22d73af7e71db6dccf27de81a9af2a5`. It retains the original
REVFIN001/REVFIN002 manifests, source verifiers, tests and the private Reverso
and Ultra code. The previous current verifier is copied byte-for-byte into
`scripts/check-reverso-publication-web-baseline.mjs`.

## Authorization and limits

The user's **JENIOS — CONCLUIR E PUBLICAR O REVERSO** instruction authorizes
publication of validated Web changes while preserving access and the previous
published version. The new manifest records only
`webPublicationApproved: true`, `publicationScope: web-only-disabled-finance`
and that instruction's reference. All inherited broad publication, broker,
debit, billing, payment issuance and live-execution capabilities remain false.
These fields are separate from the historical REVFIN002 test-only approval.

This checkpoint does not certify a real execution/cost feed, payment callback,
persistent productive entitlement writer, monthly loss-compensation rule,
authenticated browser journey or actual deployment. Those results and any
remaining blockers must be recorded separately, with evidence from the
environment in which they were actually observed.

## Source and environment gates

The dedicated branch is
`release/jenios-reverso-revpub001-20261113`. Preview and production require
GitHub provenance, the exact project `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4`, a
40-character provider SHA equal to the actual checkout HEAD, no tracked or
untracked checkout changes, and the exact finalized source inventory. The new
gate does not change `verifyUltraProductionSource` or identify this release as
the Ultra branch.

The new branch rejects enabled or ambiguous values for:

- `REVERSO_RUNTIME_READ_ENABLED`
- `REVERSO_SUBSCRIPTION_DEMO_ENABLED`
- `JENIOS_REVERSO_PLAN_ISOLATION_V1`

Only an absent value, an empty string or the literal `false` is permitted.
Runtime denial in the three deployed Reverso routes is a second boundary and
also covers a configuration change after build. See `REVPUB001-BOUNDARY.md`.
The inherited S05 Social and Platform backend, schema, prior acceptance and
G44 checks remain in force. Existing unrelated productive integrations are
preserved; this is not an authorization to enable any Reverso integration.

Preview additionally requires the isolated Social QA backend and the existing
dedicated Platform backend. The preview's external execution, payment, email,
generation, signup and Letter integration/billing flags must all be explicitly
`false`. Its public backend configuration must not be copied to production.
No environment values or credentials are included in this checkpoint.

## Preserving historical Git objects

The GitHub connector cannot reproduce the author/date metadata of the previous
local commits. A new release commit may therefore have the same reviewed
source with a different outer commit SHA. This does not replace or fabricate
the predecessor commits: the original Git objects in
`REVFIN002-WEB-PREDECESSORS.pack` are verified by SHA-256
`19c32ec2c1b3bd1c0840e0d30928ced8882cab2e2849460b7423d7a1572d5f24`
before they are imported locally.

The bootstrap checks its object pack and prerequisite before importing missing
historical objects. It does not contact a remote, move a branch, alter HEAD,
or change checkout files. `check-s05-env-scope.mjs` calls it before the
Reverso source gate; the standalone source CLI also calls it. The original
verifiers then inspect the original predecessor commits and trees. The current
provider SHA must still equal the real current HEAD. Exact pack details and
checkout prerequisites are recorded in `REVPUB001-BOUNDARY.md`.

## Closing and checking the candidate

`scripts/finalize-reverso-publication-web-release.mjs` has an explicit inventory
of reviewed replacements and additions. Without arguments it reports the
closure without writing. `--finalize` writes only the successor manifest and
the current verifier; it never stages, commits, publishes or enables features.
Unknown files, changed inherited source outside the replacement list, a
changed predecessor or unknown current verifier modifications are rejected.

The manifest pins every new file, every allowed replacement, the unchanged
predecessor tree and the normalized current verifier. The verifier checks the
exact tracked inventory, runs the unchanged historical chain on its original
inventory and predecessor bytes, and then checks the actual new bytes of each
reviewed replacement. Inherited mutations continue through the old guards.

After the coordinating agent freezes and stages the inventory, run:

```sh
node scripts/check-reverso-publication-web-release.mjs
node --test tests/reverso-publication-release.test.mjs tests/release-s05/environment-reverso-publication.test.mjs
```

The new tests are synthetic source-integrity and environment-gate tests. They
do not issue an order, debit, charge, email or external write. Test commands
in this document are a verification recipe, not a claim that they ran. Logs,
final source hashes, preview/production deployment IDs, authenticated browser
evidence and rollback status belong to the coordinating delivery checkpoint.

The preserved published predecessor at reconciliation was
`0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47`, deployment
`dpl_BXzw7t31f3Mn3UwmCnkXsYjLL793`. Reconcile it again immediately before any
publication, preserve its recovery path and do not promote an unvalidated
preview configuration to production.
