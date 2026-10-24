/** R65 extends the existing QA boundary; it never enables a production runner. */
import { timingSafeEqual } from 'node:crypto';
import { isRobotR64QaEnabled } from './robot-r64-access.mjs';

export function isRobotR65CycleEnabled(env={}) {
  return isRobotR64QaEnabled(env)&&env.JENIOS_ROBOT_R65_ENABLED==='true';
}
export function requireR65CycleEnabled(env={}) {
  if(!isRobotR65CycleEnabled(env))throw Object.assign(new Error('R65_DISABLED'),{code:'R65_DISABLED',status:404});
}
export function isR65SchedulerAuthorized(request,env={}) {
  const expected=env.JENIOS_ROBOT_R65_SCHEDULER_TOKEN;
  if(typeof expected!=='string'||expected.length<32||expected.length>256)return false;
  const received=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!received)return false;
  const a=Buffer.from(received),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}
