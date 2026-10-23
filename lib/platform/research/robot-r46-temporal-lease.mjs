/** R46: offline lease authority model. No broker or external transport.
 * All writes check authority time at acceptance, never a writer's wall clock.
 * Authority time must advance through stalls and cannot roll back; faults latch closed.
 * This models one trusted authority, not a deployed distributed clock protocol.
 */
import { performance } from 'node:perf_hooks';
import { createR45Cluster, setR45Partitions } from './robot-r45-leader-fencing.mjs';

export function createR46Authority({ replicas = 5, now = () => performance.now(), ttlMs = 1000 } = {}) {
  if (typeof now !== 'function' || !Number.isSafeInteger(ttlMs) || ttlMs <= 0)
    throw new Error('R46_INVALID_CONFIG');
  const cluster = createR45Cluster({ replicas });
  let lastTime = -Infinity, clockFailed = false, lease = null;
  let fencingToken = 0, leaseEpoch = 0, term = 0;
  const readTime = () => {
    let t;
    try { t = now(); } catch { clockFailed = true; }
    if (!Number.isFinite(t) || t < 0 || t < lastTime) clockFailed = true;
    if (clockFailed) return null;
    lastTime = t;
    return t;
  };
  const hasQuorum = id => cluster.replicas.some(r => r.id === id && r.online) &&
    (cluster.partitions.find(p => p.includes(id)) || [])
      .filter(id => cluster.replicas.find(r => r.id === id)?.online).length >= Math.floor(replicas / 2) + 1;
  const matches = credential => lease && credential?.writerId === lease.leaderId &&
    credential.fencingToken === lease.fencingToken && credential.leaseEpoch === lease.leaseEpoch;
  const grant = (id, t) => {
    if (![term, fencingToken, leaseEpoch].every(n => Number.isSafeInteger(n + 1)) || !Number.isFinite(t + ttlMs) || t + ttlMs <= t)
      throw new Error('R46_COUNTER_OR_DEADLINE_OVERFLOW');
    lease = Object.freeze({ leaderId: id, term: ++term, fencingToken: ++fencingToken,
      leaseEpoch: ++leaseEpoch, issuedAt: t, expiresAt: t + ttlMs });
    return lease;
  };
  return Object.freeze({
    elect(candidateId) {
      const t = readTime();
      if (t === null || !hasQuorum(candidateId) || (lease && t < lease.expiresAt)) return { elected: false };
      return { elected: true, ...grant(candidateId, t) };
    },
    write(credential) {
      const t = readTime();
      return Object.freeze({ allow: t !== null && matches(credential) && t < lease.expiresAt && hasQuorum(lease.leaderId) });
    },
    renew(credential) {
      const t = readTime();
      if (t === null || !matches(credential) || t >= lease.expiresAt || !hasQuorum(lease.leaderId)) return { renewed: false };
      if (!Number.isSafeInteger(leaseEpoch + 1) || !Number.isFinite(t + ttlMs) || t + ttlMs <= t)
        throw new Error('R46_COUNTER_OR_DEADLINE_OVERFLOW');
      lease = Object.freeze({ ...lease, leaseEpoch: ++leaseEpoch, expiresAt: t + ttlMs });
      return { renewed: true, ...lease };
    },
    handoff(credential, candidateId) {
      const t = readTime();
      if (t === null || !matches(credential) || t >= lease.expiresAt || candidateId === lease.leaderId ||
        !hasQuorum(lease.leaderId) || !hasQuorum(candidateId) ||
        !cluster.partitions.find(p => p.includes(lease.leaderId))?.includes(candidateId)) return { elected: false };
      // Atomic replacement at the authority invalidates the old credentials before the response.
      return { elected: true, ...grant(candidateId, t) };
    },
    partitions(parts) { setR45Partitions(cluster, parts); },
    online(id, online) {
      const node = cluster.replicas.find(r => r.id === id);
      if (!node || typeof online !== 'boolean') throw new Error('R46_INVALID_NODE');
      node.online = online;
    }
  });
}
export const r46Credential = lease => Object.freeze({ writerId: lease.leaderId,
  fencingToken: lease.fencingToken, leaseEpoch: lease.leaseEpoch });
