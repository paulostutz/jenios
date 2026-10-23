import test from 'node:test';
import assert from 'node:assert/strict';
import { createR46Authority, r46Credential as cred } from '../lib/platform/research/robot-r46-temporal-lease.mjs';
const setup = () => {
  let time = 100;
  const a = createR46Authority({ now: () => time, ttlMs: 1000 });
  return { a, set: t => { time = t; } };
};
test('R46 exact expiration boundary rejects writes and renewal', () => {
  const { a, set } = setup(), first = a.elect('R1');
  set(1099.999); assert.equal(a.write(cred(first)).allow, true);
  set(1100); assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
  set(1101); assert.equal(a.write(cred(first)).allow, false);
});
test('R46 writer wall-clock skew and cached authorization cannot extend lease', () => {
  for (const skew of [-1e12, -5000, 0, 5000, 1e12]) {
    const { a, set } = setup(), first = a.elect('R1');
    assert.equal(a.write(cred(first)).allow, true);
    set(1100);
    assert.equal(a.write({ ...cred(first), now: 100 + skew, expiresAt: Infinity }).allow, false);
  }
});
test('R46 GC stall resumes with expired credentials and cannot resurrect lease', () => {
  const { a, set } = setup(), first = a.elect('R1');
  set(100000); assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
  const second = a.elect('R1');
  assert.ok(second.fencingToken > first.fencingToken);
  assert.ok(second.leaseEpoch > first.leaseEpoch);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.write(cred(second)).allow, true);
});
test('R46 graceful handoff atomically fences the old leader', () => {
  const { a } = setup(), first = a.elect('R1');
  assert.equal(a.handoff(cred(first), 'missing').elected, false);
  assert.equal(a.write(cred(first)).allow, true);
  const next = a.handoff(cred(first), 'R3');
  assert.equal(next.elected, true);
  assert.ok(next.fencingToken > first.fencingToken);
  assert.ok(next.leaseEpoch > first.leaseEpoch);
  assert.ok(next.term > first.term);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
  assert.equal(a.write(cred(next)).allow, true);
});
test('R46 abrupt crash waits for expiry and restart cannot reuse old credentials', () => {
  const { a, set } = setup(), first = a.elect('R1');
  a.online('R1', false);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.elect('R1').elected, false);
  assert.equal(a.elect('R3').elected, false);
  set(1100); const next = a.elect('R3');
  assert.equal(next.elected, true);
  a.online('R1', true);
  assert.equal(a.write(cred(first)).allow, false);
  assert.ok(next.fencingToken > first.fencingToken);
  assert.equal(a.write(cred(next)).allow, true);
});
test('R46 renewal advances epoch and invalidates every prior credential', () => {
  const { a, set } = setup(), first = a.elect('R1');
  set(600); const next = a.renew(cred(first));
  assert.equal(next.renewed, true);
  assert.ok(next.expiresAt > first.expiresAt);
  assert.ok(next.leaseEpoch > first.leaseEpoch);
  assert.equal(next.fencingToken, first.fencingToken);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
  set(1100); assert.equal(a.write(cred(next)).allow, true);
  set(1600); assert.equal(a.write(cred(next)).allow, false);
});
test('R46 partition loses quorum; reconvergence cannot restore expired lease', () => {
  const { a, set } = setup(), first = a.elect('R1');
  a.partitions([['R1', 'R2'], ['R3', 'R4', 'R5']]);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
  assert.equal(a.handoff(cred(first), 'R3').elected, false);
  set(1100); assert.equal(a.elect('R1').elected, false);
  const next = a.elect('R3'); assert.equal(next.elected, true);
  a.partitions([['R1','R2','R3','R4','R5']]);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.write(cred(next)).allow, true);
});
test('R46 authority clock rollback, nonfinite values and exceptions latch fail closed', () => {
  for (const fault of [99, NaN, Infinity, -Infinity, -1, '100', () => { throw new Error('clock'); }]) {
    let time = 100;
    const a = createR46Authority({ now: () => typeof time === 'function' ? time() : time });
    const first = a.elect('R1'); time = fault;
    assert.equal(a.write(cred(first)).allow, false);
    time = 10000;
    assert.equal(a.write(cred(first)).allow, false);
    assert.equal(a.renew(cred(first)).renewed, false);
    assert.equal(a.elect('R3').elected, false);
  }
});
test('R46 repeated lifecycle stress has zero stale or expired allows', () => {
  const { a, set } = setup(); let previous = null;
  for (let i = 0; i < 2000; i++) {
    const t = 100 + i * 1000; set(t);
    const next = a.elect(i % 2 ? 'R3' : 'R1');
    assert.equal(next.elected, true);
    if (previous) {
      assert.ok(next.fencingToken > previous.fencingToken);
      assert.ok(next.leaseEpoch > previous.leaseEpoch);
      assert.equal(a.write(cred(previous)).allow, false);
    }
    assert.equal(a.write(cred(next)).allow, true);
    set(t + 1000); assert.equal(a.write(cred(next)).allow, false);
    previous = next;
  }
});
test('R46 real monotonic clock expires across an actual event-loop stall', () => {
  const a = createR46Authority({ ttlMs: 10 }), first = a.elect('R1');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  assert.equal(a.write(cred(first)).allow, false);
  assert.equal(a.renew(cred(first)).renewed, false);
});
test('R46 malformed credentials, offline leader and invalid configuration fail closed', () => {
  for (const ttlMs of [0, -1, NaN, Infinity, 0.5]) assert.throws(() => createR46Authority({ ttlMs }));
  const { a } = setup(), first = a.elect('R1');
  for (const value of [undefined, null, {}, { ...cred(first), fencingToken: '1' }, { ...cred(first), leaseEpoch: -1 }]) {
    assert.equal(a.write(value).allow, false);
    assert.equal(a.renew(value).renewed, false);
  }
  a.online('R1', false);
  assert.equal(a.renew(cred(first)).renewed, false);
  assert.equal(a.handoff(cred(first), 'R3').elected, false);
});
