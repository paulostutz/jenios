#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ExecutionLedger} from '../../../lib/platform/ultra/client/execution-ledger.mjs';
import {UltraExecutionRuntime} from '../../../lib/platform/ultra/client/execution-runtime.mjs';
import {OfflineFixtureBroker,quantityText} from '../../../lib/platform/ultra/client/fixture-broker.mjs';
import {operationNet,units12} from '../../../lib/platform/ultra/operation.mjs';

/** New temporary directory, known fixture class only, no config, credentials,
 * SDK, network, native adapter, telemetry, wallet, or billing arguments. */
export async function rehearseR126(){
 const directory=mkdtempSync(join(tmpdir(),'jenios-ultra-r126-fixture-'));
 const checks=[];
 async function scenario(route,name,run,entry='partial'){
  const {provider,market,currency}=route;let now=Date.now();
  const ledger=new ExecutionLedger(join(directory,`${provider}-${name}.sqlite`),{provider,environment:'demo',account:'OFFLINE_FIXTURE_ONLY_R126'});
  const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,symbol:market==='b3'?'FIXTURE_B3':'FIXTURE_CRYPTO',now:()=>now,entry});
  const config={markets:[{id:market,currency,capital:1000,leverage:1}],sessionMinutes:60,maxPositions:1,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
  const runtime=new UltraExecutionRuntime({config,market,ledger,adapter,now:()=>now,onWarning:async()=>true});
  const advance=()=>{now+=100;};
  try{
   await runtime.start({recover:true});await run({ledger,adapter,runtime,advance});
   checks.push({provider,market,scenario:name,passed:true,fixtureSubmissions:adapter.submissions,fixtureCommands:adapter.commandSubmissions,ordersSentToBroker:0});
  }finally{ledger.close();}
 }
 for(const route of [{provider:'profit',market:'b3',currency:'BRL'},{provider:'binance',market:'crypto',currency:'USDT'}]){
  await scenario(route,'lost-response-reconcile',async({ledger,adapter,runtime,advance})=>{
   adapter.failAfterSubmit=true;const result=await runtime.tick();assert.equal(result.state,'reconciliation_required');assert.equal(ledger.order(result.clientOrderId).state,'unknown');
   advance();await runtime.reconcile();assert.equal(ledger.operation(result.clientOrderId).state,'open');
   await runtime.tick();assert.equal(adapter.submissions,1);assert.equal(ledger.paused(),true);
  });
  await scenario(route,'partial-and-late-costs',async({ledger,adapter,runtime,advance})=>{
   const result=await runtime.tick(),id=result.clientOrderId;assert.equal(result.state,'open');advance();await runtime.cancel(id);advance();
   await runtime.close(id,quantityText(units12(ledger.operation(id).entryQuantity)/2n));assert.equal(ledger.operation(id).state,'partially_closed');assert.equal(operationNet(ledger.operation(id)),null);advance();
   const o=ledger.operation(id);await runtime.close(id,quantityText(units12(o.entryQuantity)-units12(o.exitQuantity)));assert.equal(ledger.operation(id).state,'closed');assert.equal(operationNet(ledger.operation(id)),null);advance();
   adapter.completeCosts(id);await runtime.reconcile();assert.notEqual(operationNet(ledger.operation(id)),null);assert.equal(adapter.submissions,1);
  });
  await scenario(route,'broker-rejection',async({ledger,adapter,runtime})=>{
   const result=await runtime.tick();assert.equal(result.state,'rejected');assert.equal(ledger.operation(result.clientOrderId).entryQuantity,'0.000000000000');assert.equal(adapter.submissions,1);
  },'reject');
  await scenario(route,'cancel-unfilled',async({ledger,adapter,runtime,advance})=>{
   const result=await runtime.tick();advance();await runtime.cancel(result.clientOrderId);assert.equal(ledger.operation(result.clientOrderId).state,'cancelled');assert.equal(adapter.commandSubmissions,1);
  },'none');
  await scenario(route,'pause-keeps-exposure-visible',async({ledger,adapter,runtime})=>{
   const result=await runtime.tick();runtime.pause();const paused=await runtime.tick();assert.equal(paused.state,'paused');assert.equal(ledger.operation(result.clientOrderId).state,'open');assert.equal(adapter.submissions,1);
  });
  await scenario(route,'disconnect-recovery-no-duplicate',async({ledger,adapter,runtime,advance})=>{
   const result=await runtime.tick();adapter.connected=false;advance();await assert.rejects(()=>runtime.tick());assert.equal(ledger.paused(),true);assert.equal(adapter.submissions,1);
   adapter.connected=true;advance();await runtime.start({recover:true});await runtime.tick();assert.equal(adapter.submissions,1);assert.equal(ledger.operation(result.clientOrderId).state,'open');
  });
  await scenario(route,'daily-loss-limit',async({ledger,adapter,runtime})=>{
   const account=adapter.account.bind(adapter);adapter.account=async()=>({...await account(),realizedLossToday:20});const result=await runtime.tick();assert.equal(result.state,'daily_limit');assert.equal(adapter.submissions,0);assert.equal(ledger.paused(),true);
  });
  await scenario(route,'protection-unconfirmed',async({ledger,adapter,runtime})=>{
   adapter.protection=false;const result=await runtime.tick();assert.equal(result.state,'protection_unconfirmed');assert.equal(adapter.submissions,0);assert.equal(ledger.paused(),true);
  });
  await scenario(route,'native-adapter-refused',async({ledger})=>{
   assert.throws(()=>new UltraExecutionRuntime({ledger,adapter:{executionEnvironment:'native'}}),/NATIVE_EXECUTION_NOT_RELEASED/);
  });
 }
 const report={schema:'JENIOS_ULTRA_REHEARSAL_R126',generatedAt:new Date().toISOString(),evidence:'offline_fixture_only',accountModel:'each_client_own_account',checks,
  nativeValidated:false,liveExecutionEnabled:false,externalPaperEnabled:false,billingEnabled:false,ordersSentToBroker:0,passed:checks.every(c=>c.passed)};
 writeFileSync(join(directory,'resultado-teste-ficticio.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 return {directory,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){console.error('Este ensaio não aceita credenciais, parâmetros nem pastas existentes.');process.exitCode=1;}
 else rehearseR126().then(({directory,report})=>console.log(JSON.stringify({directory,...report},null,2))).catch(error=>{console.error('Ensaio interrompido; nenhuma ordem real é enviada.',error.message);process.exitCode=1;});
}
