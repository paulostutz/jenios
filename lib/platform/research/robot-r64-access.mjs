/** R64 is an explicitly enabled QA integration, with no production transport. */
import { timingSafeEqual } from 'node:crypto';
import { isRobotR61QaEnabled } from './robot-r61-qa-access.mjs';

export function isRobotR64QaEnabled(env={}) {
  return isRobotR61QaEnabled(env) && env.JENIOS_ROBOT_R64_ENABLED==='true';
}
export function requireR64QaEnabled(env={}) {
  if(!isRobotR64QaEnabled(env))throw Object.assign(new Error('R64_DISABLED'),{code:'R64_DISABLED',status:404});
}
export function readR64SourceConfiguration(env={}) {
  const scopeId=env.JENIOS_ROBOT_R64_SCOPE_ID,sourceId=env.JENIOS_ROBOT_R64_SOURCE_ID;
  const publicKeyPem=env.JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY;
  if(!/^scope:[a-f0-9]{16}$/.test(scopeId||'')||!/^source:[a-f0-9]{16}$/.test(sourceId||'')||
    typeof publicKeyPem!=='string'||publicKeyPem.length>2000||!publicKeyPem.includes('BEGIN PUBLIC KEY'))
    throw Object.assign(new Error('R64_SOURCE_NOT_CONFIGURED'),{code:'R64_SOURCE_NOT_CONFIGURED',status:503});
  return Object.freeze({scopeId,sourceId,publicKeyPem,enabled:true,evidenceKind:'SIGNED_QA_REPLAY'});
}
export function isR64SchedulerAuthorized(request,env={}) {
  const expected=env.JENIOS_ROBOT_R64_SCHEDULER_TOKEN;
  if(typeof expected!=='string'||expected.length<32||expected.length>256)return false;
  const received=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!received)return false;
  const a=Buffer.from(received),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}
