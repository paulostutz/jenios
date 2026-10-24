# R44: explicit payment activation

The post-publication audit found a pre-existing inconsistency exposed by completing the Inter credentials: the health endpoint reported the payment activation flag, while the product catalogue and checkout checked credentials alone. Credentials must allow read-only diagnosis without enabling collection.

This correction requires `JENIOS_PAY_PAYMENTS_ENABLED === 'true'` in the gateway configuration and at both Pix creation boundaries. Health now reads the same gateway availability as the catalogue. Disabled checkout stops before order persistence or bank access. Read-only connection and existing receipt queries remain available.

Scope: three production files, explicit enabled fixtures in five existing test files, and four new behavioral regression tests. No payment is created by validation; no database migration, price, consent, email gate, broker behavior or AI allowance changes. The exact reviewed file hashes are recorded separately from the preserved R44/G44 manifests.

Inter was authenticated successfully on 2026-10-24 using the admin read-only probe. Actual issuance, receipt reconciliation and subscription billing are not certified by that probe. Production payment activation remains off.
