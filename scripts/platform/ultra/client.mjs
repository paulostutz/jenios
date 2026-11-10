#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateClientPlan} from '../../../lib/platform/ultra/client/plan.mjs';
import {inspectBinance} from '../../../lib/platform/ultra/client/diagnostics.mjs';
import {parseLocalReport,buildLocalDashboard} from '../../../lib/platform/ultra/client/reporting.mjs';
const [command,arg,out]=process.argv.slice(2);
function readJson(path){const bytes=readFileSync(path);if(bytes.byteLength>5_000_000)throw Error('FILE_TOO_LARGE');return JSON.parse(bytes.toString('utf8'));}
try{
 if(command==='plan'){
  const plan=validateClientPlan(readJson(arg));
  console.log(JSON.stringify({ok:true,markets:plan.config.markets,credentialLocation:plan.credentialLocation,executionAvailable:false}));
 }else if(command==='doctor'){
  if(arg==='binance')console.log(JSON.stringify({ok:true,...await inspectBinance({environment:process.env.JENIOS_ULTRA_ENVIRONMENT,apiKey:process.env.JENIOS_BINANCE_API_KEY,apiSecret:process.env.JENIOS_BINANCE_API_SECRET})}));
  else if(['mt5','profit'].includes(arg)){
   let response;
   try{response=execFileSync(process.env.JENIOS_PYTHON||'python',[fileURLToPath(new URL('./terminal_diagnostic.py',import.meta.url)),arg],{encoding:'utf8',timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:65536});}
   catch(e){response=e.stdout?.toString();if(!response)throw Error('LOCAL_PYTHON_OR_TERMINAL_UNAVAILABLE');}
   const result=JSON.parse(response);console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
  }else throw Error('INVALID_PROVIDER');
 }else if(command==='report'){
  const input=parseLocalReport(readJson(arg));const report=buildLocalDashboard(input,{period:'all'});
  if(out)writeFileSync(out,JSON.stringify(report,null,2),{encoding:'utf8',flag:'wx',mode:0o600});
  else console.log(JSON.stringify(report,null,2));
 }else{
  console.log('JENIOS Ultra R116 — preparação local\nNode.js 24 LTS. Nenhuma ordem é enviada por este pacote.\n\nnode scripts/platform/ultra/client.mjs plan CONFIGURACAO.json\nnode scripts/platform/ultra/client.mjs doctor binance|mt5|profit\nnode scripts/platform/ultra/client.mjs report RELATORIO.json [SAIDA.json]\n\nCredenciais somente neste computador. Consulte LEIA-ME.md.');
  if(command)process.exitCode=1;
 }
}catch(e){console.error(JSON.stringify({ok:false,error:/^[A-Z_]{3,100}$/.test(e.message)?e.message:'LOCAL_COMMAND_FAILED',executionAvailable:false}));process.exitCode=1;}
