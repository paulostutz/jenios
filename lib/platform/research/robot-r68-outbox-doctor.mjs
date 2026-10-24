/**
 * R68 — bounded, read-only diagnosis of the certified R66/R67 local outboxes.
 * No emitter, runtime, private executable, session, worker or sender is created.
 * Inspection under a retained lock never grants authority to recover that lock.
 * PID and unchanged file observations are not process-death or fencing evidence.
 */
import { createHash } from 'node:crypto';
import { canonicalPrivateDurableJson } from './robot-private-durable-file.mjs';
import { diagnoseR66ObservationOutbox } from './robot-r66-observation-outbox.mjs';
import { diagnoseR67PrivateCaptureOutbox } from './robot-r67-private-capture-outbox.mjs';
import { diagnoseR71PrivateCaptureOutbox } from './robot-r71-private-capture-outbox.mjs';

const SCHEMA = 'JENIOS_R68_OUTBOX_DOCTOR_V1';
const PROFILES = Object.freeze({ R66_OBSERVATION: diagnoseR66ObservationOutbox,
  R67_PRIVATE_CAPTURE: diagnoseR67PrivateCaptureOutbox,
  R71_PRIVATE_EVOLUTION: diagnoseR71PrivateCaptureOutbox });
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const counters = () => ({ PENDING: 0, UNCONFIRMED: 0, ACKNOWLEDGED: 0, EXPIRED_UNCONFIRMED: 0 });

function summarizeQueue(inspection, nowMs, profile) {
  if (!inspection.queue) return { queue: null, capacity: null };
  const source = inspection.queue, persisted = counters(), observed = counters(), sessions = new Map();
  let attempts = 0, inFlight = 0, unknownOutcome = 0, newlyObservedExpired = 0, sequenceBlocked = 0,
    expiredPredecessorBlocked = 0, metadataEligible = 0, clockBlocked = 0, attemptLimitBlocked = 0,
    maximumAttempts = 0, oldestCapturedAtMs = null, nextExpiryAtMs = null;
  const expired = entry => entry.persistedState !== 'ACKNOWLEDGED' &&
    (entry.expiredAtMs !== null || nowMs >= entry.expiresAtMs);
  for (const entry of source.entries) {
    persisted[entry.persistedState]++;
    const observedState = expired(entry) ? 'EXPIRED_UNCONFIRMED' : entry.persistedState;
    observed[observedState]++;
    if (observedState === 'EXPIRED_UNCONFIRMED' && entry.expiredAtMs === null) newlyObservedExpired++;
    attempts += entry.attemptCount; maximumAttempts = Math.max(maximumAttempts, entry.attemptCount);
    if (entry.lastAttemptOutcome === 'IN_FLIGHT') inFlight++;
    if (entry.persistedState !== 'ACKNOWLEDGED' && entry.attemptCount > 0) unknownOutcome++;
    oldestCapturedAtMs = oldestCapturedAtMs === null ? entry.capturedAtMs : Math.min(oldestCapturedAtMs, entry.capturedAtMs);
    if (!sessions.has(entry.sessionId)) sessions.set(entry.sessionId, { sessionId: entry.sessionId,
      firstUnconfirmedSequence: null, firstExpiredSequence: null, blockedEntries: 0, expiredPredecessorBlockedEntries: 0 });
    const session = sessions.get(entry.sessionId);
    const priorUnconfirmed = session.firstUnconfirmedSequence !== null && session.firstUnconfirmedSequence < entry.sequence;
    const priorExpired = session.firstExpiredSequence !== null && session.firstExpiredSequence < entry.sequence;
    const unacknowledged = entry.persistedState !== 'ACKNOWLEDGED';
    const orderedBlock = ['R67_PRIVATE_CAPTURE', 'R71_PRIVATE_EVOLUTION'].includes(profile) && unacknowledged && priorUnconfirmed;
    if (orderedBlock) { sequenceBlocked++; session.blockedEntries++; }
    if (orderedBlock && priorExpired) { expiredPredecessorBlocked++; session.expiredPredecessorBlockedEntries++; }
    if (unacknowledged && !expired(entry)) {
      nextExpiryAtMs = nextExpiryAtMs === null ? entry.expiresAtMs : Math.min(nextExpiryAtMs, entry.expiresAtMs);
      const wrongClock = nowMs < entry.capturedAtMs || (entry.lastAttemptAtMs !== null && nowMs < entry.lastAttemptAtMs);
      const attemptsExhausted = entry.attemptCount >= inspection.limits.maxAttempts;
      if (wrongClock) clockBlocked++;
      if (attemptsExhausted) attemptLimitBlocked++;
      if (!wrongClock && !attemptsExhausted && !orderedBlock) metadataEligible++;
    }
    if (unacknowledged && session.firstUnconfirmedSequence === null) session.firstUnconfirmedSequence = entry.sequence;
    if (expired(entry) && session.firstExpiredSequence === null) session.firstExpiredSequence = entry.sequence;
  }
  const recordDigests = source.entries.map(entry => entry.recordSha256);
  const retainedRecordsSha256 = createHash('sha256').update(canonicalPrivateDurableJson(recordDigests, profile)).digest('hex');
  return {
    queue: { scopeId: source.scopeId, sourceId: source.sourceId, sourceKeySha256: source.sourceKeySha256,
      revision: source.revision, entries: source.entries.length, sessions: source.sessionCount, attempts,
      persistedStates: persisted, statesAtObservation: observed, newlyObservedExpired,
      inFlightAttempts: inFlight, unknownOutcomeEntries: unknownOutcome,
      sequenceBlockedEntries: sequenceBlocked, expiredPredecessorBlockedEntries: expiredPredecessorBlocked,
      eligibleByQueueMetadata: metadataEligible, clockBlockedEntries: clockBlocked, attemptLimitBlockedEntries: attemptLimitBlocked,
      blockedSessions: [...sessions.values()].filter(session => session.blockedEntries > 0),
      oldestCapturedAtMs, nextExpiryAtMs, retainedRecordsSha256,
      expiryCalculationOnly: true, deliveryAdmissionVerified: false },
    capacity: { maxBytes: inspection.limits.maxBytes, storedBytes: inspection.snapshot.byteLength,
      remainingBytes: inspection.limits.maxBytes - inspection.snapshot.byteLength,
      maxEntries: inspection.limits.maxEntries, entries: source.entries.length,
      remainingEntries: inspection.limits.maxEntries - source.entries.length,
      maxSessions: inspection.limits.maxSessions, sessions: source.sessionCount,
      remainingSessions: inspection.limits.maxSessions - source.sessionCount,
      maxAttemptsPerEntry: inspection.limits.maxAttempts, maximumObservedAttempts: maximumAttempts,
      attemptLimitBlockedEntries: attemptLimitBlocked, throughputCertified: false, physicalPurgeAllowed: false },
  };
}

/**
 * Required inputs contain only a closed profile, local private directory, HMAC
 * key, the already configured public trust root, and the explicit observation
 * time. Configuration never supplies callbacks, filenames or recovery claims.
 * Invalid permissions, HMAC, source binding or protocol state fail closed.
 */
export function diagnoseR68Outbox(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('R68_DOCTOR_CONFIG');
  const properties = Object.getOwnPropertyDescriptors(input);
  const keys = ['profile', 'directory', 'key', 'trustedSource', 'nowMs'];
  if (Reflect.ownKeys(properties).length !== keys.length || !keys.every(key => properties[key] &&
      properties[key].enumerable && Object.hasOwn(properties[key], 'value'))) fail('R68_DOCTOR_CONFIG');
  const { profile, directory, key, trustedSource, nowMs } = input;
  if (typeof profile !== 'string' || !Object.hasOwn(PROFILES, profile)) fail('R68_DOCTOR_PROFILE');
  if (!integer(nowMs)) fail('R68_DOCTOR_CLOCK');
  const inspection = PROFILES[profile]({ directory, key, trustedSource });
  const { queue, capacity } = summarizeQueue(inspection, nowMs, profile);
  const locksPresent = inspection.locks.some(lock => lock.present);
  const status = !inspection.observationStable ? 'INCONCLUSIVE_CHANGE' : locksPresent ? 'BLOCKED_LOCK_PRESENT' :
    inspection.temporaryFiles.length ? 'REVIEW_TEMPORARY_FILES' : inspection.unrecognizedEntries ? 'REVIEW_UNRECOGNIZED_ENTRIES' :
      queue?.statesAtObservation.EXPIRED_UNCONFIRMED ? 'OBSERVED_EXPIRED_UNCONFIRMED' :
        inspection.snapshot.present ? 'OBSERVED_QUEUE' : 'OBSERVED_EMPTY';
  const binding = { profile, observedAtMs: nowMs, directory: inspection.directory,
    inventorySha256: inspection.inventorySha256, snapshotSha256: inspection.snapshot.sha256,
    locks: inspection.locks.map(lock => ({ name: lock.name, present: lock.present, sha256: lock.sha256, identity: lock.identity })),
    temporaryFiles: inspection.temporaryFiles.map(file => ({ name: file.name, sha256: file.sha256, identity: file.identity })),
    retainedRecordsSha256: queue?.retainedRecordsSha256 ?? null };
  const planSha256 = createHash('sha256').update(canonicalPrivateDurableJson(binding, profile)).digest('hex');
  return freeze({ schema: SCHEMA, profile, status, observedAtMs: nowMs, readOnly: true,
    observationStable: inspection.observationStable, inventoryComplete: inspection.inventoryComplete,
    observationMeaning: 'BOUNDED_LOCAL_FILE_OBSERVATION_NOT_HOST_EXCLUSIVITY',
    directory: inspection.directory, snapshot: inspection.snapshot, locks: inspection.locks,
    temporaryFiles: inspection.temporaryFiles, unrecognizedEntries: inspection.unrecognizedEntries,
    inventorySha256: inspection.inventorySha256, inspectionLimits: inspection.inspectionLimits, queue, capacity,
    recoveryPlan: { kind: 'READ_ONLY_REVIEW_PLAN', planSha256, executable: false,
      actions: [
        'Preserve the exact snapshot, lock and temporary-file bytes identified by this observation.',
        'Establish externally verified exclusion of every writer and sender on the selected host before any lock recovery.',
        'Reinspect after that exclusion; a PID, lock age, file hash or operator declaration alone is not a fence.',
        'Retain unresolved attempts and expired records; never infer an ACK, renew timestamps, sign replacements or promote temporary files.',
        'After a separately authorized recovery, reopen a new runtime session and retry only exact unexpired records through the existing verified ACK path.',
      ], automaticUnlockAvailable: false, manualUnlockCommandProvided: false,
      snapshotSelectionAuthorized: false, physicalDeletionAuthorized: false, recordResigningAuthorized: false },
    processOwnershipVerified: false, exclusiveHostFenceVerified: false, monotonicWitnessVerified: false,
    recoveryAuthorized: false, operationalReady: false, hostedReadinessVerified: false,
    privateRuntimeExecuted: false, customerMonitoringActive: false, realOrdersSent: 0,
    externalPaperOrdersSent: 0, paidProviderCalls: 0, hostedDatabaseChanges: 0,
    productionChanged: false, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null });
}
