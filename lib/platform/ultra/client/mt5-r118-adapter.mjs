import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MT5CollectorAdapter} from './mt5-adapter.mjs';
/** Preserve the R117 protocol while selecting its additive history fix. */
export class MT5R118CollectorAdapter extends MT5CollectorAdapter {
 constructor(profile,{spawnImpl=spawn}={}){
  super(profile,{spawnImpl:(command,args,options)=>spawnImpl(command,[fileURLToPath(new URL('../../../../scripts/platform/ultra/mt5_collector_r118.py',import.meta.url))],options)});
 }
}
