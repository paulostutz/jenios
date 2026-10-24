/** Private evolution is a separate, explicit QA boundary. No hosted service is enabled here. */
import { timingSafeEqual } from 'node:crypto';
import { isRobotR67QaEnabled, readR67SourceConfiguration } from './robot-r67-access.mjs';
import { isR65AdminOriginAllowed } from './robot-r65-cycle-access.mjs';

const value = (env, key) => {
  const d = env && typeof env === 'object' ? Object.getOwnPropertyDescriptor(env, key) : null;
  return d && Object.hasOwn(d, 'value') && typeof d.value === 'string' ? d.value : undefined;
};
export function isRobotR71QaEnabled(env = {}) {
  return isRobotR67QaEnabled(env) && value(env, 'JENIOS_ROBOT_R71_ENABLED') === 'true';
}
export function requireR71QaEnabled(env = {}) {
  if (!isRobotR71QaEnabled(env)) throw Object.assign(Error('R71_DISABLED'), { code: 'R71_DISABLED', status: 404 });
}
export function readR71SourceConfiguration(env = {}) {
  requireR71QaEnabled(env);
  return readR67SourceConfiguration(env);
}
export function isR71AdminOriginAllowed(request, env = {}) {
  const origin = value(env, 'JENIOS_ROBOT_R71_ADMIN_ORIGIN');
  if (!origin) return false;
  // Retain the certified canonical-origin comparison. Neither Host nor
  // Forwarded can elect a trusted origin, including Next loopback rewrites.
  return isR65AdminOriginAllowed(request, { JENIOS_ROBOT_R65_ADMIN_ORIGIN: origin });
}
export function isR71SchedulerAuthorized(request, env = {}) {
  const expected = value(env, 'JENIOS_ROBOT_R71_SCHEDULER_TOKEN');
  const previous = value(env, 'JENIOS_ROBOT_R65_SCHEDULER_TOKEN');
  if (!expected || expected.length < 32 || expected.length > 256 || /\s/.test(expected) || expected === previous) return false;
  const received = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
