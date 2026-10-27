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

/** Next may normalize a loopback request URL; external authority is server-pinned.
 * Forwarded/Host headers never select the trusted origin. */
export function isR65AdminOriginAllowed(request,env={}) {
  try{
    const expected=Object.hasOwn(env,'JENIOS_ROBOT_R65_ADMIN_ORIGIN')?env.JENIOS_ROBOT_R65_ADMIN_ORIGIN:new URL(request.url).origin;
    if(typeof expected!=='string')return false;
    const parsed=new URL(expected);
    if(parsed.origin!==expected||!['https:','http:'].includes(parsed.protocol))return false;
    if(parsed.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))return false;
    const received=request.headers.get('origin');
    return received===null||received===expected;
  }catch{return false;}
}
