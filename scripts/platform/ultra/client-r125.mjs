#!/usr/bin/env node
import {openSync,readSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateClientPlanR125,clientRoutesR125} from '../../../lib/platform/ultra/client/plan-r125.mjs';
export function inspectPlanR125(file){const fd=openSync(file,'r'),buffer=Buffer.alloc(16001);let length=0;try{while(length<buffer.length){const count=readSync(fd,buffer,length,buffer.length-length,null);if(!count)break;length+=count;}}finally{closeSync(fd);}if(length>16000)throw Error('PLAN_TOO_LARGE');const input=JSON.parse(buffer.subarray(0,length).toString('utf8')),plan=validateClientPlanR125(input);return {ok:true,version:'R125',markets:plan.config.markets,routes:clientRoutesR125(plan),credentialLocation:'trader_device',executionAvailable:false};}
export function main(args=process.argv.slice(2)){if(args.length!==2||args[0]!=='plan')throw Error('USAGE_CLIENT_R125_PLAN_FILE');return inspectPlanR125(resolve(args[1]));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(main()));}catch{console.error(JSON.stringify({ok:false,error:'INVALID_LOCAL_PLAN',executionAvailable:false}));process.exitCode=1;}}
