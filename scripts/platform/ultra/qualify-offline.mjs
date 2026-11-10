#!/usr/bin/env node
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ExecutionLedger} from '../../../lib/platform/ultra/client/execution-ledger.mjs';
import {UltraExecutionRuntime} from '../../../lib/platform/ultra/client/execution-runtime.mjs';
import {OfflineFixtureBroker,quantityText} from '../../../lib/platform/ultra/client/fixture-broker.mjs';
import {units12,operationNet} from '../../../lib/platform/ultra/operation.mjs';
/** Synthetic qualification data must never be uploaded to trader telemetry. */
export async function qualifyOffline(directory){
 const root=directory?resolve(directory):mkdtempSync(join(tmpdir(),'jenios-ultra-offline-'));
 mkdirSync(root,{recursive:true,mode:0o700});const results=[];
 for(const [market,provider,currency,symbol] of [['crypto','binance','USDT','FIXTURE_CRYPTO'],['forex','mt5','USD','FIXTURE_FOREX'],['b3','profit','BRL','FIXTURE_B3']]){
  let now=Date.now();const ledger=new ExecutionLedger(join(root,provider+'.sqlite'),{provider,environment:'demo',account:'OFFLINE_FIXTURE_ONLY'});
  const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,symbol,now:()=>now});
  const config={markets:[{id:market,currency,capital:1000,leverage:20}],sessionMinutes:60,maxPositions:1,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
  const runtime=new UltraExecutionRuntime({config,market,ledger,adapter,now:()=>now,onWarning:async()=>true});
  try{
   await runtime.start({recover:true});
   if(ledger.operations().length)throw Error('QUALIFICATION_DIRECTORY_MUST_BE_EMPTY');
   adapter.failAfterSubmit=true;const entry=await runtime.tick();now+=100;await runtime.reconcile();
   const id=entry.clientOrderId;await runtime.cancel(id);now+=100;let operation=ledger.operation(id);
   await runtime.close(id,quantityText(units12(operation.entryQuantity)/2n));now+=100;operation=ledger.operation(id);
   await runtime.close(id,quantityText(units12(operation.entryQuantity)-units12(operation.exitQuantity)));now+=100;
   if(operationNet(ledger.operation(id))!==null)throw Error('COSTS_MUST_REMAIN_PENDING');
   adapter.completeCosts(id);await runtime.reconcile();
   results.push({provider,market,currency,qualification:'offline_fixture_only',nativeValidated:false,ordersSentToBroker:0,fixtureSubmissions:adapter.submissions,fixtureCommands:adapter.commandSubmissions,operations:ledger.operations(),receipts:ledger.receipts().length,revisions:ledger.outbox('qualification',1000).length});
  }finally{ledger.close();}
 }
 const report={schema:'JENIOS_ULTRA_OFFLINE_QUALIFICATION_R118',generatedAt:new Date().toISOString(),liveExecutionEnabled:false,externalPaperEnabled:false,nativeValidated:false,results};
 writeFileSync(join(root,'qualificacao-offline.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return {directory:root,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length>3){console.error('USAGE_QUALIFY_OFFLINE_OPTIONAL_NEW_DIRECTORY');process.exitCode=1;}
 else qualifyOffline(process.argv[2]).then(result=>console.log(JSON.stringify({directory:result.directory,qualification:'offline_fixture_only',nativeValidated:false,ordersSentToBroker:0,markets:result.report.results.length}))).catch(error=>{console.error(/^[A-Z0-9_]{1,80}$/.test(error.message)?error.message:'OFFLINE_QUALIFICATION_FAILED');process.exitCode=1;});
}
