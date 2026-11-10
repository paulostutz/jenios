import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export class MT5CollectorAdapter {
 constructor(profile,{spawnImpl=spawn}={}){this.profile=profile;this.spawnImpl=spawnImpl;this.pending=new Map();this.sequence=0;this.serial=Promise.resolve();this.child=null;}
 connect(){
  if(this.child)return;
  this.child=this.spawnImpl(process.env.JENIOS_PYTHON||'python',[fileURLToPath(new URL('../../../../scripts/platform/ultra/mt5_worker.py',import.meta.url))],{stdio:['pipe','pipe','ignore'],windowsHide:true});
  const child=this.child;
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{if(line.length>24_000_000){child.kill();return;}let value;try{value=JSON.parse(line);}catch{child.kill();return;}const pending=this.pending.get(value.id);if(!pending){if(value.ok===false)child.kill();return;}clearTimeout(pending.timer);this.pending.delete(value.id);value.ok?pending.resolve(value.result):pending.reject(Error(/^[A-Z0-9_]{1,80}$/.test(value.error)?value.error:'MT5_BRIDGE_ERROR'));});
  const died=()=>{if(this.child!==child)return;this.child=null;for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(Error('MT5_BRIDGE_DISCONNECTED'));}this.pending.clear();};
  child.once('error',died);child.once('exit',died);child.stdin.on('error',()=>child.kill());child.stdin.write(JSON.stringify(this.profile)+'\n');
 }
 call(method,args={}){
  const run=()=>new Promise((resolve,reject)=>{this.connect();const id=++this.sequence;const timer=setTimeout(()=>{this.pending.delete(id);this.child?.kill();reject(Error('MT5_RESULT_UNKNOWN'));},30000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,args})+'\n');});
  const result=this.serial.then(run,run);this.serial=result.catch(()=>{});return result;
 }
 inspect(){return this.call('inspect');}
 collect(days){return this.call('collect',{days});}
 shutdown(){this.child?.stdin.end();}
}
