import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAssetSymbol} from '../lib/platform/asset-symbol.mjs';
import {socialAuthReturnPath} from '../app/components/social-auth-return.mjs';
import {appendSimIntention,readSimJournal} from '../lib/platform/simulation-journal.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('simulation preserves selected quantity across screens without claiming execution',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const item={ativo:'PETR4',direcao:'COMPRA',modo:'manual',valor:1000,quantidade:3};
 assert.equal(appendSimIntention(storage,'owner',item).ok,true);
 const saved=readSimJournal(storage,'owner')[0];
 assert.equal(saved.quantidade,3);assert.equal(saved.executed,false);
 assert.equal(readSimJournal(storage,'other').length,0);
 assert.equal(appendSimIntention(storage,'owner',{...item,quantidade:1.5}).ok,false);
});
test('laboratory pause follows the same session control and is rechecked before replay',()=>{
 const lab=read('app/components/platform/PlatformStrategyLab.js');
 assert.match(lab,/\[userId,balance,pauseSignal\]/);
 assert.match(lab,/if\(readSimulationPaused\(window.sessionStorage,userId\)\)/);
 for(const page of ['dashboard','mesa-operacoes'])assert.match(read('app/'+page+'/page.js'),/<PlatformStrategyLab[^>]+paused=/);
});
test('asset lookup routes B3, crypto, forex and US symbols to their intended exchange',()=>{
 for(const [input,expected] of [[' petr4 ','BMFBOVESPA:PETR4'],['WIN','BMFBOVESPA:WIN1!'],['WDO1!','BMFBOVESPA:WDO1!'],['BTC/USDT','BINANCE:BTCUSDT'],['XRPUSDT','BINANCE:XRPUSDT'],['EUR/USD','FX:EURUSD'],['XAUUSD','OANDA:XAUUSD'],['AAPL','NASDAQ:AAPL'],['NASDAQ:NVDA','NASDAQ:NVDA'],['NYSE:BRK.B','NYSE:BRK.B']])
  assert.deepEqual(resolveAssetSymbol(input).symbol,expected,input);
});
test('unknown or malformed symbols cannot silently replace a chart with another asset',()=>{
 for(const input of ['',null,{},'UNKNOWN','<script>','AAPL?x=y','EUR USD','A:B:C','A'.repeat(49),'NYSE:','https://example.com']){
  const result=resolveAssetSymbol(input);assert.equal(result.ok,false,String(input));assert.equal(result.symbol,undefined);
 }
 for(const page of ['dashboard','mesa-operacoes']){
  const s=read('app/'+page+'/page.js');
  assert.match(s,/<AssetSearch onSelect=/);
  assert.match(s,/setAtivoSelecionado\(asset.symbol\)/);
  assert.doesNotMatch(s,/simboloFormatado/);
 }
});
test('login return destinations stay in the explicit application allowlist',()=>{
 for(const path of ['/dashboard','/mesa-operacoes','/dashboard-logado','/universidade','/diagnostico'])assert.equal(socialAuthReturnPath(path),path);
 for(const path of ['//evil.test','https://evil.test','/dashboard?next=//evil.test','/dashboard/../../admin','/%2f%2fevil.test','\\evil.test',{},null])assert.equal(socialAuthReturnPath(path),'/social');
});
test('direct operating routes hide their children behind remote session verification',()=>{
 for(const route of ['dashboard','mesa-operacoes','diagnostico','platform/aprender','platform/assistente'])assert.match(read('app/'+route+'/layout.js'),/<PlatformAuthGuard/);
 const guard=read('app/components/platform/PlatformAuthGuard.js');
 assert.match(guard,/if\(state.phase==='authorized'\)return/);
 assert.match(guard,/resolveSocialPortalEntry\(\)/);
 assert.match(guard,/platformSupabase.auth.getUser\(\)/);
 assert.match(guard,/setState\(\{phase:'checking',access:null\}\)/);
});
test('direct Platform entry offers Social login explicitly and keeps dedicated credentials isolated',()=>{
 const page=read('app/platform/entrar/page.js');
 assert.match(page,/useState\(false\)/);
 assert.match(page,/if\(!dedicated\)return/);
 assert.match(page,/<SocialAccessForm returnTo=\{destination\}/);
 assert.match(page,/platformSupabase.auth.signInWithPassword/);
 assert.doesNotMatch(page,/socialClient.auth.signInWithPassword/);
 assert.match(read('app/login/page.js'),/socialAuthReturnPath/);
});
