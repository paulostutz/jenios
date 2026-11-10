// UM001: preparation and synthetic, process-local reconciliation only.
// No network, gateway, database, subscription entitlement or debit.
import { createHash } from 'node:crypto';
import { assertReceipt } from '../../clients/central-billing-client.mjs';

export const UM001_POLICY = 'ultra-monthly-performance-um001-2026-11-10';
export const ULTRA_PURPOSE = 'ultra_monthly_performance';
const PRODUCTS = new Set(['jenios', 'kivoryn_flow']);
const PRESERVED_ACTIONS = new Set(['consult', 'read', 'reconcile', 'cancel', 'reduce_risk']);
const OPEN_ACTIONS = new Set(['open', 'start_open', 'new_opening']);
const ENVIRONMENTS = new Set(['demo', 'paper', 'sandbox', 'testnet', 'live', 'real']);
const DRAFTS = new WeakSet();
const fail = code => { throw Object.assign(new Error(code), { code }); };
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const freeze = v => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
const copy = v => structuredClone(v);
const id = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const sha = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const integer = v => typeof v === 'number' && Number.isSafeInteger(v);
const timestamp = v => typeof v === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().replace('.000Z', 'Z') === v;
const unique = list => [...new Set(list)].sort();
const utcSeconds = value => typeof value === 'string' ? value.replace(/\.000Z$/, 'Z') : value;

function scopeContract(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const pending = [], scope = {};
  if (!PRODUCTS.has(input.product)) pending.push('ULTRA_PRODUCT_REQUIRED');
  scope.product = PRODUCTS.has(input.product) ? input.product : null;
  for (const k of ['company_id', 'customer_id', 'billing_account_id', 'broker_account_id', 'receiver_id', 'legal_entity_id']) {
    scope[k] = id(input[k]) ? input[k] : null;
    if (scope[k] === null) pending.push('ULTRA_SCOPE_' + k.toUpperCase());
  }
  scope.environment = ENVIRONMENTS.has(input.environment) ? input.environment : null;
  scope.currency = /^[A-Z]{3}$/.test(input.currency ?? '') ? input.currency : null;
  scope.month = /^\d{4}-(0[1-9]|1[0-2])$/.test(input.month ?? '') ? input.month : null;
  scope.timezone = null;
  if (typeof input.timezone === 'string') {
    try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); scope.timezone = input.timezone; } catch {}
  }
  for (const k of ['environment', 'currency', 'month', 'timezone']) if (scope[k] === null) pending.push('ULTRA_' + k.toUpperCase() + '_REQUIRED');
  scope.collection_product = PRODUCTS.has(input.collection_product) ? input.collection_product : null;
  return { scope, pending };
}

function periodContract(input, scope) {
  // The report uses Date.toISOString() (.000Z); Letter v1 uses UTC seconds.
  // Removing an exactly-zero fraction preserves the instant without rounding.
  const start = utcSeconds(input?.period_start), end = utcSeconds(input?.period_end);
  if (!scope.month || !scope.timezone || !timestamp(start) || !timestamp(end) || start >= end) return null;
  const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: scope.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(date)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  const a = parts(start), b = parts(end);
  const [year, month] = scope.month.split('-').map(Number);
  const following = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  if (`${a.year}-${a.month}` !== scope.month || `${b.year}-${b.month}` !== following) return null;
  if ([a, b].some(p => p.day !== '01' || p.hour !== '00' || p.minute !== '00' || p.second !== '00')) return null;
  return { period_start: start, period_end: end };
}

function assessmentScopeBinding(assessment, identity, period) {
  const pending = [], source = assessment.scope_binding;
  const present = source && typeof source === 'object' && !Array.isArray(source);
  const identityKeys = Object.keys(identity), binding = {};
  for (const key of [...identityKeys, 'source_account_key', 'period_start', 'period_end']) {
    const value = present ? source[key] : null;
    binding[key] = typeof value === 'string' && value.length > 0 ? value : null;
    if (binding[key] === null) pending.push('ASSESSMENT_SCOPE_BINDING_REQUIRED');
  }
  for (const key of identityKeys) {
    if (binding[key] !== null && binding[key] !== identity[key]) pending.push('ASSESSMENT_SCOPE_BINDING_MISMATCH');
  }
  for (const key of ['period_start', 'period_end']) {
    binding[key] = utcSeconds(binding[key]);
    if (binding[key] !== null && (!timestamp(binding[key]) || binding[key] !== period?.[key])) pending.push('ASSESSMENT_SCOPE_BINDING_MISMATCH');
  }
  const calculation = assessment.calculation;
  const metadata = {
    accountKey: binding.source_account_key, month: identity.month, timeZone: identity.timezone,
    currency: identity.currency, environment: identity.environment,
    periodStart: period?.period_start, periodEnd: period?.period_end,
  };
  for (const [key, expected] of Object.entries(metadata)) {
    const value = calculation?.[key];
    if (typeof value !== 'string' || !value.length) pending.push('CALCULATION_SCOPE_METADATA_REQUIRED');
    else if ((key === 'periodStart' || key === 'periodEnd' ? utcSeconds(value) : value) !== expected) pending.push('CALCULATION_SCOPE_METADATA_MISMATCH');
  }
  // This is an explicit synthetic source binding, not an inferred user/account
  // mapping and not authentication. The source account key must remain intact.
  return { binding: present ? binding : null, pending };
}

function arithmetic(profit, rate, rounding) {
  const product = BigInt(profit) * BigInt(rate), divisor = 10000n;
  if (product % divisor !== 0n && rounding !== 'minor-unit-half-up') return null;
  const rounded = rounding === 'minor-unit-half-up' ? (product + divisor / 2n) / divisor : product / divisor;
  const result = Number(rounded);
  return Number.isSafeInteger(result) ? result : null;
}

/** Pure, immutable draft. All amounts use minor units. Missing remains null. */
export function prepareMonthlyPerformance({ scope: input, assessment, period } = {}) {
  if (!assessment || assessment.synthetic_only !== true) fail('SYNTHETIC_ASSESSMENT_REQUIRED');
  const { scope, pending: missingScope } = scopeContract(input);
  const monthPeriod = periodContract(period ?? input, scope);
  const identity = Object.fromEntries([
    'company_id', 'customer_id', 'billing_account_id', 'broker_account_id',
    'receiver_id', 'legal_entity_id', 'environment', 'currency', 'month', 'timezone',
  ].map(k => [k, scope[k]]));
  // Product is provenance, not a second billing namespace for the same client.
  const obligationId = missingScope.length ? null : 'ultra-monthly:' + digest({ kind: ULTRA_PURPOSE, ...identity });
  const pending = [...missingScope, ...(Array.isArray(assessment.pending_reasons)
    ? assessment.pending_reasons.filter(v => typeof v === 'string' && v.length <= 200) : [])];
  const sourceBinding = assessmentScopeBinding(assessment, identity, monthPeriod);
  pending.push(...sourceBinding.pending);
  if (!Array.isArray(assessment.pending_reasons) || assessment.pending_reasons.some(v => typeof v !== 'string' || v.length > 200)) pending.push('PENDING_REASONS_INVALID');
  if (!monthPeriod) pending.push('MONTH_BOUNDARIES_REQUIRED');
  if (assessment.complete !== true || !['ready', 'no_performance_due'].includes(assessment.status)) pending.push('ASSESSMENT_INCOMPLETE');
  if (!integer(assessment.eligible_profit_minor)) pending.push('ELIGIBLE_RESULT_REQUIRED');
  if (!sha(assessment.evidence_sha256)) pending.push('ASSESSMENT_EVIDENCE_REQUIRED');
  if (typeof assessment.policy_version !== 'string' || !assessment.policy_version) pending.push('ASSESSMENT_POLICY_REQUIRED');
  if (!assessment.calculation || typeof assessment.calculation !== 'object' || Array.isArray(assessment.calculation)) pending.push('CALCULATION_MEMORY_REQUIRED');
  const profit = integer(assessment.eligible_profit_minor) ? assessment.eligible_profit_minor : null;
  const rate = [1000, 2000].includes(assessment.rate_bps) ? assessment.rate_bps : null;
  for (const key of ['eligible_profit_minor', 'rate_bps', 'performance_minor']) {
    if (assessment.calculation && Object.hasOwn(assessment.calculation, key) && assessment.calculation[key] !== assessment[key]) pending.push('CALCULATION_MEMORY_MISMATCH');
  }
  if (assessment.status === 'no_performance_due' && profit !== null && profit > 0) pending.push('ASSESSMENT_STATUS_MISMATCH');
  if (profit !== null && profit > 0) {
    if (rate === null) pending.push('PERFORMANCE_RATE_REQUIRED');
    if (assessment.plan_eligibility_confirmed !== true) pending.push('PLAN_ELIGIBILITY_REQUIRED');
    if (assessment.policy_resolution_confirmed !== true) pending.push('BUSINESS_POLICY_PENDING');
  }
  let amount = null;
  if (pending.length === 0 && profit > 0) {
    amount = arithmetic(profit, rate, assessment.rounding_policy);
    if (amount === null) pending.push('ROUNDING_POLICY_REQUIRED');
    if (amount !== null && assessment.performance_minor !== amount) pending.push('PERFORMANCE_CALCULATION_MISMATCH');
  } else if (pending.length === 0 && profit <= 0) {
    amount = 0;
    if (assessment.performance_minor !== 0) pending.push('PERFORMANCE_CALCULATION_MISMATCH');
  }
  const status = pending.length ? 'assessment_pending' : amount === 0 ? 'no_performance_due' : 'prepared';
  if (status === 'assessment_pending') amount = null;
  const issuanceReasons = [];
  if (status !== 'prepared') issuanceReasons.push('NO_PREPARED_PERFORMANCE');
  if (!scope.collection_product) issuanceReasons.push('CENTRAL_COLLECTION_PRODUCT_REQUIRED');
  if (scope.currency !== 'BRL') issuanceReasons.push('CENTRAL_CURRENCY_CONVERSION_UNDEFINED');
  // Preserve existing Letter Ledger BRL limits; never silently round up/carry over.
  if (amount !== null && amount > 0 && amount < 250) issuanceReasons.push('BELOW_EXISTING_CENTRAL_MINIMUM');
  if (amount !== null && amount > 9999999999) issuanceReasons.push('ABOVE_EXISTING_CENTRAL_LIMIT');
  const fingerprintBody = {
    identity, collection_product: scope.collection_product, policy: UM001_POLICY,
    period: monthPeriod, assessment: {
      eligible_profit_minor: profit, rate_bps: rate, performance_minor: amount,
      policy_version: assessment.policy_version ?? null, evidence_sha256: assessment.evidence_sha256 ?? null,
      scope_binding: sourceBinding.binding,
      calculation: assessment.calculation ?? null, rounding_policy: assessment.rounding_policy ?? null,
      pending_reasons: unique(pending),
    }, status,
  };
  const draft = freeze({
    schema_version: 'letter-ultra-monthly-um001', synthetic_only: true,
    production_enabled: false, bank_contacted: false, debit_executed: false,
    real_invoice_created: false, execution_authorization: false,
    obligation_id: obligationId, kind: ULTRA_PURPOSE, source_product: scope.product,
    identity, collection_product: scope.collection_product, period: monthPeriod,
    status, eligible_profit_minor: profit, rate_bps: rate, performance_minor: amount,
    calculation: copy(assessment.calculation ?? null), pending_reasons: unique(pending),
    scope_binding: copy(sourceBinding.binding),
    policy_version: UM001_POLICY, source_policy_version: assessment.policy_version ?? null,
    evidence_sha256: assessment.evidence_sha256 ?? null, fingerprint: digest(fingerprintBody),
    separation: { subscription: 'separate', annual_waives_performance: false, defi: 'unchanged', start: 'separate' },
    central_plan: {
      target: 'existing_letter_group_billing', purpose_candidate: ULTRA_PURPOSE,
      production_purpose_enabled: false, methods: scope.currency === 'BRL' ? ['boleto', 'pix'] : [],
      eligible_for_synthetic_invoice: issuanceReasons.length === 0,
      pending_reasons: unique(issuanceReasons),
      before_real_issuance: ['authorized_monthly_assessment', 'native_identity_binding', 'specific_terms_and_consent',
        'approved_due_date_and_payer', 'central_purpose_and_receiver_authorization', 'durable_unique_emission_reservation',
        'authenticated_payment_and_reversal_reconciliation', 'homologation'],
    },
  });
  DRAFTS.add(draft);
  return draft;
}

/** Process-local fictitious harness; never a production ledger/repository. */
export function createSyntheticPerformanceLab(options = {}) {
  if (options.syntheticOnly !== true || Object.keys(options).some(k => k !== 'syntheticOnly')) fail('SYNTHETIC_LAB_ONLY');
  const obligations = new Map(), invoices = new Map(), evidence = new WeakMap(), proofUses = new Map(), events = [];
  const cloneView = row => freeze({ ...copy(row), synthetic_only: true, real_invoice_created: false, debit_executed: false, execution_authorization: false });
  const requireRow = obligationId => obligations.get(obligationId) ?? fail('OBLIGATION_NOT_FOUND');
  const addEvent = (kind, row, facts = {}) => events.push(freeze({ sequence: events.length + 1, kind, obligation_id: row.obligation_id, ...facts }));
  const expectedReceipt = row => ({
    product: row.draft.collection_product, company_id: row.draft.identity.company_id,
    purpose: ULTRA_PURPOSE, external_invoice_id: row.obligation_id,
    customer_id: row.draft.identity.customer_id, receiver_id: row.draft.identity.receiver_id,
    legal_entity_id: row.draft.identity.legal_entity_id, amount_cents: row.draft.performance_minor,
    currency: row.draft.identity.currency, ...row.draft.period,
  });
  const bindingFor = row => ({ obligation_id: row.obligation_id, ...row.draft.identity });
  return Object.freeze({
    registerDraft(draft) {
      if (!DRAFTS.has(draft)) fail('PREPARED_DRAFT_REQUIRED');
      if (!draft.obligation_id) fail('CENTRAL_IDENTITY_PENDING');
      const old = obligations.get(draft.obligation_id);
      if (old) {
        if (old.draft.fingerprint !== draft.fingerprint) {
          old.reconciliation_required = true;
          addEvent('assessment_conflict', old);
          fail('ASSESSMENT_CONFLICT');
        }
        if (!old.source_products.includes(draft.source_product)) old.source_products.push(draft.source_product);
        return freeze({ created: false, obligation: cloneView(old) });
      }
      const row = { obligation_id: draft.obligation_id, draft, status: draft.status,
        source_products: [draft.source_product], invoice_id: null, receipt: null, confirmed_at: null,
        proof_sha256: null, reconciliation_required: false, release_count: 0 };
      obligations.set(row.obligation_id, row); addEvent('draft_registered', row);
      return freeze({ created: true, obligation: cloneView(row) });
    },
    markSyntheticAwaitingPayment(obligationId, invoiceId) {
      const row = requireRow(obligationId);
      if (!id(invoiceId) || !invoiceId.startsWith('synthetic-')) fail('SYNTHETIC_INVOICE_ID_REQUIRED');
      if (row.reconciliation_required) fail('RECONCILIATION_REQUIRED');
      if (row.invoice_id) {
        if (row.invoice_id !== invoiceId) fail('SECOND_INVOICE_FORBIDDEN');
        return cloneView(row);
      }
      if (row.status !== 'prepared' || !row.draft.central_plan.eligible_for_synthetic_invoice) fail('DRAFT_NOT_ISSUABLE');
      if (invoices.has(invoiceId)) fail('INVOICE_ALREADY_BOUND');
      row.invoice_id = invoiceId; row.status = 'awaiting_payment';
      invoices.set(invoiceId, { obligation_id: obligationId, revision: 0, receipt: null, binding: null });
      addEvent('synthetic_invoice_awaiting_payment', row, { invoice_id: invoiceId });
      return cloneView(row);
    },
    expectedSyntheticReceipt(obligationId) {
      const row = requireRow(obligationId);
      if (!row.invoice_id) fail('SYNTHETIC_INVOICE_REQUIRED');
      return freeze({ schema_version: 1, id: row.invoice_id, ...expectedReceipt(row),
        state: 'issued', verified_paid: false, proof_sha256: null, confirmed_at: null });
    },
    expectedSyntheticBinding(obligationId) { return freeze(bindingFor(requireRow(obligationId))); },
    // Test-only fixture ingestion. Strings/booleans here are not production
    // authority. The consumer accepts only a snapshot branded by this instance.
    observeSyntheticLetter({ receipt, binding, authority, synthetic_only } = {}) {
      if (authority !== 'letter-synthetic-lab' || synthetic_only !== true) fail('SYNTHETIC_LETTER_AUTHORITY_REQUIRED');
      const invoice = invoices.get(receipt?.id);
      if (!invoice) fail('SYNTHETIC_INVOICE_UNKNOWN');
      const row = requireRow(invoice.obligation_id);
      assertReceipt(receipt, expectedReceipt(row));
      if (digest(binding) !== digest(bindingFor(row))) fail('CENTRAL_BINDING_MISMATCH');
      if (receipt.state === 'paid' && receipt.verified_paid !== true) fail('VERIFIED_PAYMENT_REQUIRED');
      if (receipt.verified_paid === true && !timestamp(receipt.confirmed_at)) fail('CENTRAL_CONFIRMATION_TIME_REQUIRED');
      const bodyHash = digest({ receipt, binding });
      if (invoice.bodyHash !== bodyHash) {
        invoice.revision += 1; invoice.receipt = copy(receipt); invoice.binding = copy(binding); invoice.bodyHash = bodyHash;
      }
      if (row.status === 'paid' && (receipt.state !== 'paid' || receipt.verified_paid !== true
          || receipt.proof_sha256 !== row.proof_sha256 || receipt.confirmed_at !== row.confirmed_at)) {
        // Preserve the paid receipt. A contradictory later observation requires
        // reconciliation; do not invent reversal/refund policy or silently clear it.
        row.reconciliation_required = true;
        addEvent('paid_receipt_revalidation_required', row, { invoice_id: row.invoice_id });
      }
      const snapshot = freeze({ authority: 'letter-synthetic-lab', synthetic_only: true,
        invoice_id: receipt.id, revision: invoice.revision, receipt: copy(receipt), binding: copy(binding) });
      evidence.set(snapshot, { invoice_id: receipt.id, revision: invoice.revision, bodyHash });
      return snapshot;
    },
    confirmSyntheticPayment(obligationId, snapshot) {
      const row = requireRow(obligationId), proof = evidence.get(snapshot);
      if (!proof) fail('AUTHORITATIVE_LAB_SNAPSHOT_REQUIRED');
      if (proof.invoice_id !== row.invoice_id) fail('PAYMENT_WRONG_OBLIGATION');
      const invoice = invoices.get(proof.invoice_id);
      if (invoice.revision !== proof.revision || invoice.bodyHash !== proof.bodyHash) fail('STALE_PAYMENT_SNAPSHOT');
      if (row.reconciliation_required) fail('RECONCILIATION_REQUIRED');
      const receipt = snapshot.receipt;
      assertReceipt(receipt, expectedReceipt(row));
      if (receipt.state !== 'paid' || receipt.verified_paid !== true) fail('VERIFIED_PAYMENT_REQUIRED');
      if (digest(snapshot.binding) !== digest(bindingFor(row))) fail('CENTRAL_BINDING_MISMATCH');
      const previousUse = proofUses.get(receipt.proof_sha256);
      if (previousUse && previousUse !== row.obligation_id) fail('PAYMENT_PROOF_ALREADY_USED');
      if (row.status === 'paid') {
        if (row.proof_sha256 !== receipt.proof_sha256 || row.confirmed_at !== receipt.confirmed_at) fail('PAID_RECEIPT_IMMUTABLE');
        return freeze({ changed: false, released_once: false, obligation: cloneView(row) });
      }
      if (row.status !== 'awaiting_payment') fail('PAYMENT_NOT_EXPECTED');
      row.status = 'paid'; row.receipt = copy(receipt); row.proof_sha256 = receipt.proof_sha256;
      row.confirmed_at = receipt.confirmed_at; row.release_count += 1; proofUses.set(receipt.proof_sha256, row.obligation_id);
      addEvent('synthetic_payment_confirmed', row, { invoice_id: row.invoice_id });
      return freeze({ changed: true, released_once: true, obligation: cloneView(row) });
    },
    gate({ customer_id, billing_account_id, environment, action } = {}) {
      if (!id(customer_id) || !id(billing_account_id) || !ENVIRONMENTS.has(environment)) fail('GATE_IDENTITY_REQUIRED');
      if (!PRESERVED_ACTIONS.has(action) && !OPEN_ACTIONS.has(action)) fail('GATE_ACTION_UNSUPPORTED');
      const debts = [...obligations.values()].filter(row => row.draft.identity.customer_id === customer_id
        && row.draft.identity.billing_account_id === billing_account_id && row.draft.identity.environment === environment
        && (row.status === 'awaiting_payment' || (row.status === 'paid' && row.reconciliation_required)))
        .map(row => row.obligation_id).sort();
      return freeze({ synthetic_only: true, actual_execution_authorized: false,
        action, allowed_in_simulation: !OPEN_ACTIONS.has(action) || debts.length === 0,
        blocked_obligations: OPEN_ACTIONS.has(action) ? debts : [],
        reason: OPEN_ACTIONS.has(action) && debts.length ? 'UNPAID_ULTRA_PERFORMANCE' : 'BILLING_GATE_CLEAR' });
    },
    read(obligationId) { return cloneView(requireRow(obligationId)); },
    audit() { return freeze(copy(events)); },
  });
}
