#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ExecutionLedger} from '../../../lib/platform/ultra/client/execution-ledger.mjs';
import {OfflineFixtureBroker} from '../../../lib/platform/ultra/client/fixture-broker.mjs';
import {DurableUltraRuntimeR127} from '../../../lib/platform/ultra/client/session-runtime-r127.mjs';

export async function rehearseSessionR127(){
 const directory=mkdtempSync(join(tmpdir(),'jenios-ultra-r127-fixture-')),checks=[];
 for(const [provider,market,currency] of [['profit','b3','BRL'],['binance','crypto','USDT']]){
  const path=join(directory,provider+'.sqlite'),binding={provider,environment:'demo',account:'FIXTURE_ONLY_R127'};
  let now=Date.now(),ledger=new ExecutionLedger(path,binding);
  const adapter=new OfflineFixtureBroker({binding:ledger.binding,market,currency,symbol:'FIXTURE_ONLY',now:()=>now});
  const config={markets:[{id:market,currency,capital:1000,leverage:1}],sessionMinutes:2,maxPositions:1,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]};
  const options={sessionId:'fixture-session-1',ownerScope:'fixture-owner',connectionScope:'fixture-connection',config,market,adapter,now:()=>now};
  let runtime=new DurableUltraRuntimeR127({...options,ledger});
  const pass=scenario=>checks.push({provider,market,scenario,passed:true,ordersSentToBroker:0});
  try{
   await runtime.start();const expiry=runtime.session().expiresAtMs;now+=1000;assert.equal((await runtime.start()).created,false);assert.equal(runtime.session().expiresAtMs,expiry);pass('start-idempotent');
   runtime.pause();now+=1000;await runtime.resume();assert.equal(runtime.session().expiresAtMs,expiry);pass('pause-resume-preserves-deadline');
   ledger.close();ledger=new ExecutionLedger(path,binding);runtime=new DurableUltraRuntimeR127({...options,ledger});
   assert.equal((await runtime.start()).resumeRequired,true);await runtime.resume({recover:true});assert.equal(runtime.session().expiresAtMs,expiry);pass('restart-preserves-deadline');
   const entry=await runtime.tick();assert.equal(entry.state,'open');now=expiry;await runtime.tick();assert.equal(runtime.session().phase,'expired');assert.equal(ledger.operation(entry.clientOrderId).state,'open');assert.equal(adapter.submissions,1);pass('expiry-keeps-exposure-visible');
   const second=new DurableUltraRuntimeR127({...options,ledger,sessionId:'fixture-session-2'});
   await assert.rejects(()=>second.start(),/SESSION_EXPOSURE_RECONCILIATION_REQUIRED/);pass('new-session-blocked-with-exposure');
   assert.equal((await runtime.finish()).phase,'draining');assert.equal((await runtime.closePositions()).state,'confirmed');assert.equal((await runtime.finish()).phase,'ended');pass('finish-requires-confirmed-flat');
   now+=1000;await second.start();assert.equal(second.session().expiresAtMs,now+120000);assert.throws(()=>runtime.pause(),/SESSION_SUPERSEDED/);assert.equal(ledger.paused(),false);pass('fresh-session-and-stale-control-fence');
  }finally{ledger.close();}
 }
 const report={schema:'JENIOS_ULTRA_SESSION_REHEARSAL_R127',generatedAt:new Date().toISOString(),checks,passed:checks.every(c=>c.passed),
  evidence:'offline_fixture_only',accountModel:'each_client_own_account',ordersSentToBroker:0,nativeValidated:false,liveExecutionEnabled:false,externalPaperEnabled:false,billingEnabled:false};
 writeFileSync(join(directory,'resultado-sessao-ficticia.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 return {directory,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){console.error('O ensaio não aceita parâmetros, credenciais ou pastas existentes.');process.exitCode=1;}
 else rehearseSessionR127().then(({directory,report})=>console.log(JSON.stringify({directory,...report},null,2))).catch(error=>{console.error('Ensaio interrompido; nenhuma ordem real é enviada.',error.message);process.exitCode=1;});
}
