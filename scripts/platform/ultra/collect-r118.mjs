#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {OperationLedger} from '../../../lib/platform/ultra/client/operation-ledger.mjs';
import {MT5R118CollectorAdapter} from '../../../lib/platform/ultra/client/mt5-r118-adapter.mjs';
import {BinanceOrderCollector,binanceReadOnlyKeyFingerprint} from '../../../lib/platform/ultra/client/binance-collector.mjs';
import {synchronizeOperations} from '../../../lib/platform/ultra/client/sync.mjs';
import {readProfile,ingest} from './operations.mjs';
const fail=code=>{throw Error(code);};
export function readBinanceProfile(path){
 const raw=readFileSync(path);if(raw.length>32000)fail('PROFILE_TOO_LARGE');const p=JSON.parse(raw);
 const keys=['schema','product','environment','expectedKeyFingerprint','references','evidenceDirectory'];
 if(!p||p.schema!=='JENIOS_ULTRA_BINANCE_READONLY_PROFILE_R118'||p.product!=='usds_m_futures'||Object.keys(p).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(p,k))||!['live','demo'].includes(p.environment)||! /^[a-f0-9]{64}$/.test(p.expectedKeyFingerprint)||!Array.isArray(p.references)||p.references.length<1||p.references.length>50||typeof p.evidenceDirectory!=='string'||!p.evidenceDirectory||p.evidenceDirectory.length>1000)fail('INVALID_BINANCE_PROFILE');
 return {...p,evidenceDirectory:resolve(dirname(path),p.evidenceDirectory)};
}
export async function main(args=process.argv.slice(2)){
 const [command,file,option]=args;
 if(command==='identify-binance'){
  if(args.length!==2||!['demo','live'].includes(file))fail('USAGE_IDENTIFY_BINANCE_ENVIRONMENT');
  console.log(JSON.stringify({keyFingerprint:binanceReadOnlyKeyFingerprint(process.env.JENIOS_BINANCE_API_KEY,file),identityScope:'api_key_not_account_uid',networkUsed:false}));return;
 }
 if(!['identify-mt5','mt5','binance'].includes(command)||!file||args.length>3||option&&option!=='--once')fail('USAGE_COLLECT_R118_COMMAND_PROFILE_ONCE');
 let adapter,ledger,stop=false;const shutdown=()=>{stop=true;};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 try{
  const profile=command==='binance'?readBinanceProfile(resolve(file)):readProfile(resolve(file));
  if(command==='binance'){
   adapter=new BinanceOrderCollector(profile);mkdirSync(profile.evidenceDirectory,{recursive:true,mode:0o700});
  }else{
   if(profile.provider!=='mt5')fail('INVALID_MT5_COMMAND');adapter=new MT5R118CollectorAdapter(profile);const checked=await adapter.inspect();
   if(command==='identify-mt5'){console.log(JSON.stringify({accountFingerprint:checked.accountFingerprint,environment:checked.environment,readOnly:checked.readOnly}));return;}
   if(checked.readOnly!==true||checked.accountFingerprint!==profile.accountFingerprint||checked.environment!==profile.environment)fail('MT5_ACCOUNT_BINDING_MISMATCH');
   mkdirSync(dirname(profile.ledger),{recursive:true,mode:0o700});ledger=new OperationLedger(profile.ledger,{account:profile.accountFingerprint,provider:'mt5',environment:profile.environment});
   try{chmodSync(profile.ledger,0o600);}catch{if(process.platform!=='win32')fail('LOCAL_FILE_PERMISSIONS_FAILED');}
   ledger.claim(Date.now(),{recover:true});
  }
  do{
   ledger?.heartbeat(Date.now());let runtimeState='monitoring';
   try{
    if(command==='binance'){
     const evidence=await adapter.collect(profile.references);writeFileSync(join(profile.evidenceDirectory,'binance-'+Date.now()+'-'+randomUUID()+'.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
     console.log(JSON.stringify({readOnly:true,ordersCollected:evidence.orders.length,positionOwnershipVerified:false,costsComplete:false,synchronizedToPlatform:false}));
    }else{
     const batch=await adapter.collect(profile.days);ingest(ledger,batch.operations,profile);console.log(JSON.stringify({readOnly:true,collected:batch.operations.length,at:batch.generatedAt}));
    }
   }catch(error){runtimeState='error';console.error(/^[A-Z0-9_]{1,80}$/.test(error.message)?error.message:'COLLECTION_FAILED');if(option==='--once')throw error;}
   if(ledger&&process.env.JENIOS_ULTRA_SYNC_TOKEN){try{await synchronizeOperations({ledger,token:process.env.JENIOS_ULTRA_SYNC_TOKEN,...profile,runtimeState});}catch{console.error('SYNC_PENDING_LOCAL_RECORDS_PRESERVED');}}
   if(option==='--once')break;
   for(let n=0;n<60&&!stop;n++)await new Promise(resolve=>setTimeout(resolve,1000));
  }while(!stop);
 }finally{adapter?.shutdown?.();ledger?.close();process.off('SIGINT',shutdown);process.off('SIGTERM',shutdown);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^[A-Z0-9_]{1,80}$/.test(error.message)?error.message:'COLLECTOR_COMMAND_FAILED');process.exitCode=1;});
