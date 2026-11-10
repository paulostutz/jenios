#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {OperationLedger} from '../../../lib/platform/ultra/client/operation-ledger.mjs';
import {MT5CollectorAdapter} from '../../../lib/platform/ultra/client/mt5-adapter.mjs';
import {synchronizeOperations} from '../../../lib/platform/ultra/client/sync.mjs';
import {operationsCsv} from '../../../lib/platform/ultra/client/operation-export.mjs';
import {validateOperation} from '../../../lib/platform/ultra/operation.mjs';
const fail=code=>{throw Error(code);};
export function readProfile(path){
 const buffer=readFileSync(path);if(buffer.length>16000)fail('PROFILE_TOO_LARGE');const p=JSON.parse(buffer);
 if(!p||Object.keys(p).some(k=>!['provider','environment','market','accountFingerprint','connectionLabel','ledger','magic','days','positionCostsComplete'].includes(k))||!['mt5','binance','profit'].includes(p.provider)||!['demo','live'].includes(p.environment)||!['forex','b3','crypto'].includes(p.market)||typeof p.accountFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(p.accountFingerprint)||typeof p.connectionLabel!=='string'||!p.connectionLabel.trim()||p.connectionLabel.length>80||typeof p.ledger!=='string'||!p.ledger||p.ledger.length>1000||!Number.isSafeInteger(p.days)||p.days<1||p.days>365)fail('INVALID_PROFILE');
 if(p.provider==='mt5'&&!['forex','b3'].includes(p.market)||p.provider==='binance'&&p.market!=='crypto'||p.provider==='profit'&&p.market!=='b3')fail('PROFILE_MARKET_MISMATCH');
 if(p.provider==='mt5'&&(!Number.isSafeInteger(p.magic)||p.magic<1||p.magic>2147483647||typeof p.positionCostsComplete!=='boolean'))fail('INVALID_MT5_PROFILE');
 return {...p,ledger:resolve(dirname(path),p.ledger)};
}
export function ingest(ledger,operations,profile,{now=Date.now()}={}){
 if(!Array.isArray(operations)||operations.length>20000)fail('INVALID_OPERATION_BATCH');
 const rows=operations.map(o=>validateOperation(o,{market:profile.market,now}));
 return ledger.transaction(()=>rows.map(o=>ledger.saveOperation(o,{now})).length);
}
export async function main(args=process.argv.slice(2)){
 const [command,file,input]=args;if(!['identify','mt5','import','sync','report'].includes(command)||!file||args.length>3)fail('USAGE_OPERATIONS_COMMAND_PROFILE_OPTION');
 const profile=readProfile(resolve(file));let adapter=null,ledger=null,stop=false;
 const shutdown=()=>{stop=true;};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 try{
  if(command==='mt5'||command==='identify'){
   if(profile.provider!=='mt5'||input&&input!=='--once')fail('INVALID_MT5_COMMAND');
   adapter=new MT5CollectorAdapter(profile);const checked=await adapter.inspect();
   if(command==='identify'){console.log(JSON.stringify({accountFingerprint:checked.accountFingerprint,environment:checked.environment,readOnly:checked.readOnly}));return;}
   if(checked.readOnly!==true||checked.accountFingerprint!==profile.accountFingerprint||checked.environment!==profile.environment)fail('MT5_ACCOUNT_BINDING_MISMATCH');
  }
  mkdirSync(dirname(profile.ledger),{recursive:true,mode:0o700});
  ledger=new OperationLedger(profile.ledger,{account:profile.accountFingerprint,provider:profile.provider,environment:profile.environment});
  try{chmodSync(profile.ledger,0o600);}catch{if(process.platform!=='win32')throw Error('LOCAL_FILE_PERMISSIONS_FAILED');}
  ledger.claim(Date.now(),{recover:true});
  if(command==='import'){
   if(!input)fail('RECEIPT_FILE_REQUIRED');const raw=readFileSync(resolve(input));if(raw.length>20_000_000)fail('RECEIPT_FILE_TOO_LARGE');const report=JSON.parse(raw);
   if(report.schema!=='JENIOS_ULTRA_OPERATIONS_V1'||report.provider!==profile.provider||report.environment!==profile.environment||report.accountFingerprint!==profile.accountFingerprint)fail('RECEIPT_SCOPE_MISMATCH');
   console.log(JSON.stringify({recorded:ingest(ledger,report.operations,profile),source:'local_connector_file'}));
  }else if(command==='report'){
   const base=resolve(input||'jenios-ultra-operacoes');writeFileSync(base+'.json',JSON.stringify({...ledger.localReport(profile),accountFingerprint:profile.accountFingerprint},null,2),{mode:0o600,flag:'wx'});
   writeFileSync(base+'.csv',operationsCsv(ledger.operations(),profile),{mode:0o600,flag:'wx'});console.log('REPORT_EXPORTED');
  }else if(command==='sync'){
   let result;do{ledger.heartbeat(Date.now());result=await synchronizeOperations({ledger,token:process.env.JENIOS_ULTRA_SYNC_TOKEN,...profile});console.log(JSON.stringify(result));}while(result.synced===100&&!stop);
  }else{
   do{
    ledger.heartbeat(Date.now());let runtimeState='monitoring';
    try{const batch=await adapter.collect(profile.days);ingest(ledger,batch.operations,profile);console.log(JSON.stringify({collected:batch.operations.length,at:batch.generatedAt}));}
    catch(e){runtimeState='error';console.error(/^[A-Z0-9_]{1,80}$/.test(e.message)?e.message:'COLLECTION_FAILED');if(input==='--once')throw e;}
    if(process.env.JENIOS_ULTRA_SYNC_TOKEN){try{await synchronizeOperations({ledger,token:process.env.JENIOS_ULTRA_SYNC_TOKEN,...profile,runtimeState});}catch{console.error('SYNC_PENDING_LOCAL_RECORDS_PRESERVED');}}
    if(input==='--once')break;
    for(let n=0;n<15&&!stop;n++)await new Promise(r=>setTimeout(r,1000));
   }while(!stop);
  }
 }finally{adapter?.shutdown();ledger?.close();process.off('SIGINT',shutdown);process.off('SIGTERM',shutdown);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(/^[A-Z0-9_]{1,80}$/.test(e.message)?e.message:'OPERATIONS_COMMAND_FAILED');process.exitCode=1;});
