import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findAssets} from '../lib/platform/asset-catalog.mjs';
import {parseBRLInput,formatBRLInput,formatBRLEdit} from '../lib/platform/brl-input.mjs';
import {ACTIVE_TREND_MODULES} from '../lib/trends-ui.mjs';
import {createNewTokenRadar} from '../lib/newTokenRadar.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

test('R44 preview is limited to its QA project, isolated databases and disabled external actions',()=>{
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-experience-r44-20261024',VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture'};
 assert.equal(checkS05DeploymentScope(env).mode,'preview-isolated-client-experience');
 assert.equal(checkS05DeploymentScope({...env,VERCEL_PROJECT_ID:'other'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'}).ok,false);
 for(const key of ['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED'])assert.equal(checkS05DeploymentScope({...env,[key]:'true'}).ok,false,key);
});

test('company name preserves share-class choices; ticker selects the named asset',()=>{
 assert.deepEqual(findAssets('petrobras').map(a=>a.ticker),['PETR3','PETR4']);
 assert.deepEqual(findAssets('petr3').map(a=>a.symbol),['BMFBOVESPA:PETR3']);
 assert.deepEqual(findAssets('Itaú').map(a=>a.symbol),findAssets('itau').map(a=>a.symbol));
 assert.equal(findAssets('bitcoin')[0].symbol,'BINANCE:BTCUSDT');
 assert.equal(findAssets('mini índice')[0].symbol,'BMFBOVESPA:WIN1!');
 assert.deepEqual(findAssets('unlisted issuer'),[]);
 assert.deepEqual(findAssets('<script>alert(1)</script>'),[]);
});
test('BRL entry preserves reais and centavos without ambiguous decimal conversion',()=>{
 for(const [text,value] of [['100000',100000],['100.000,00',100000],['R$ 1.234,56',1234.56],['0,01',0.01],['1,',1],['0',0]])assert.equal(parseBRLInput(text),value,text);
 for(const text of ['','-1','1.23','1,234','1e5','R$','100.000.001,00','1,2,3','NaN'])assert.equal(parseBRLInput(text),null,text);
 assert.equal(formatBRLEdit('100000,5'),'100.000,5');
 assert.equal(formatBRLInput(100000),'100.000,00');
 assert.equal(formatBRLInput(1234.56),'1.234,56');
});
test('all Hub surfaces use the active modules and the existing new-token radar',()=>{
 assert.deepEqual(ACTIVE_TREND_MODULES.map(m=>m.id),['megapulse','baleias']);
 for(const path of ['app/components/TrendsHub.js','app/components/SocialSidebarPremium.js'])assert.match(readFileSync(path,'utf8'),/ACTIVE_TREND_MODULES/);
 const dashboard=readFileSync('app/dashboard/page.js','utf8');
 assert.doesNotMatch(dashboard,/tokenPanel|Tendências de busca/);
 assert.match(dashboard,/<NewTokenRadar/);
});
test('network coverage can surface an eligible older pool excluded from the youngest global page',async()=>{
 const now=Date.parse('2026-10-24T21:00:00Z'),urls=[];
 const pool={id:'eth_0xabc',type:'pool',attributes:{address:'0xabc',pool_created_at:'2026-10-24T20:00:00Z',reserve_in_usd:'50000',volume_usd:{h1:'100000'},price_change_percentage:{h1:'10'},transactions:{h1:{buys:200,sells:100,buyers:100}}},relationships:{base_token:{data:{id:'eth_0xdef'}}}};
 const token={id:'eth_0xdef',type:'token',attributes:{address:'0xdef',name:'Fixture',symbol:'QA',coingecko_coin_id:null}};
 const radar=createNewTokenRadar({now:()=>now,env:{},fetchImpl:async url=>{
  urls.push(url);
  if(url.includes('/base/'))return {ok:false,status:503};
  return {ok:true,json:async()=>url.includes('/eth/')?{data:[pool],included:[token]}:{data:[],included:[]}};
 }});
 const result=await radar();
 assert.equal(urls.length,5);assert.equal(result.disponivel,true);assert.equal(result.parcial,true);
 assert.equal(result.candidatos.length,1);assert.equal(result.amostra.poolsNaFaixaEtaria,1);
 assert.equal(result.candidatos[0].criacaoTokenConfirmada,false);
 await radar();assert.equal(urls.length,5);
});
