import test from 'node:test';
import assert from 'node:assert/strict';
import {readSimJournal,appendSimIntention,clearSimJournal,journalKey} from '../lib/platform/simulation-journal.mjs';
import {summarizeVerifiedRisk,loadVerifiedRiskSummary,RISK_TABLE} from '../lib/platform/risk-evidence.mjs';
import {loadAccountRisk} from '../lib/platform/risk-client.mjs';
import {adaptiveModeSuggestion} from '../lib/platform/diagnostic-routing.mjs';
import {getJeniosPlatformAdmin} from '../lib/platform/admin-db.mjs';
import {readFileSync} from 'node:fs';

const storage=()=>{const m=new Map();return{
  getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),
  raw:(k,v)=>m.set(k,v)};};
const when=new Date('2026-10-19T02:30:00Z');
const event=(id,kind='risk_block',source='broker_confirmed',pnl=null)=>({
 id,kind,source,verified_at:'2026-10-19T02:30:00Z',observed_at:'2026-10-19T02:28:00Z',
 realized_pnl_cents:pnl
});
test('B66 journal is empty and scoped before first click',()=>{
 assert.deepEqual(readSimJournal(storage(),'A'),[]);
 assert.notEqual(journalKey('A'),journalKey('B'));
});
test('B66 Dashboard and Mesa share same session journal for one account',()=>{
 const s=storage(),a=appendSimIntention(s,'A',{ativo:'WIN',direcao:'COMPRA (BUY)',modo:'manual',capital:500},when);
 assert.equal(a.ok,true);assert.equal(readSimJournal(s,'A').length,1);
 assert.equal(readSimJournal(s,'A')[0].direcao,'COMPRA');
 assert.equal(readSimJournal(s,'A')[0].executed,false);
 assert.equal(readSimJournal(s,'A')[0].verified,false);
});
test('B66 local journal never proves realized trades or prevented losses',()=>{
 const s=storage();
 appendSimIntention(s,'A',{ativo:'BTC',direcao:'VENDA (SELL)',modo:'reversa',valor:200},when);
 const e=readSimJournal(s,'A')[0];
 assert.equal(e.source,'client_simulation');assert.equal('pnl' in e,false);assert.equal(e.executed,false);
});
test('B66 local journal cannot leak across distinct user IDs',()=>{
 const s=storage();
 appendSimIntention(s,'A',{ativo:'A',direcao:'COMPRA',modo:'manual',valor:100},when);
 appendSimIntention(s,'B',{ativo:'B',direcao:'VENDA',modo:'reversa',valor:100},when);
 assert.equal(readSimJournal(s,'A')[0].ativo,'A');
 assert.equal(readSimJournal(s,'B')[0].ativo,'B');
});
test('B66 invalid orders are rejected without journal mutation',()=>{
 const s=storage();
 for(const p of [{ativo:'X',direcao:'HOLD',modo:'manual',valor:100},
  {ativo:'X',direcao:'COMPRA',modo:'invalid',valor:100},
  {ativo:'X',direcao:'COMPRA',modo:'manual',valor:-1},
  {ativo:'X',direcao:'COMPRA',modo:'manual',valor:Infinity}
 ])assert.equal(appendSimIntention(s,'A',p,when).ok,false);
 assert.deepEqual(readSimJournal(s,'A'),[]);
});
test('B66 compromised client event cannot be marked verified',()=>{
 const s=storage(),key=journalKey('A');
 s.raw(key,JSON.stringify({version:1,events:[{id:'x',ativo:'WIN',direcao:'COMPRA',
  modo:'manual',valor:100,hora:'14:00',timestamp:100,
  source:'client_simulation',executed:false,verified:true,pnl:10000000}]}));
 const e=readSimJournal(s,'A')[0];assert.equal(e.verified,false);assert.equal(e.pnl,undefined);
});
test('B66 clear affects only selected account session',()=>{
 const s=storage();for(const id of ['A','B'])appendSimIntention(s,id,{ativo:id,direcao:'COMPRA',modo:'manual',valor:1},when);
 assert.equal(clearSimJournal(s,'A'),true);
 assert.equal(readSimJournal(s,'A').length,0);
 assert.equal(readSimJournal(s,'B').length,1);
});
test('B66 risk evidence never invents an avoided loss amount',()=>{
 assert.equal(summarizeVerifiedRisk([]).avoidedLossBRL,null);
 assert.equal(summarizeVerifiedRisk([event('a')]).avoidedLossBRL,null);
});
test('B66 broker-confirmed blocks are kept separate from paper',()=>{
 const s=summarizeVerifiedRisk([event('a'),event('b','risk_block','paper_confirmed')]);
 assert.equal(s.verifiedBlocks,1);assert.equal(s.paperBlocks,1);
 assert.equal(s.evidenceStatus,'broker_evidence');
});
test('B66 duplicate or forged local confirmations are rejected',()=>{
 const x=summarizeVerifiedRisk([event('a'),event('a'),
  event('b','risk_block','client_simulation'),
  {...event('c'),verified_at:null}]);
 assert.equal(x.verifiedBlocks,1);
});
test('B66 only broker closed trades with valid PNL become educational input',()=>{
 const rows=[event('A','closed_trade','broker_confirmed',-1000),
  event('B','closed_trade','paper_confirmed',-1000),
  event('C','closed_trade','broker_confirmed',null),
  event('D','closed_trade','broker_confirmed',Number.NaN)];
 const result=summarizeVerifiedRisk(rows);
 assert.equal(result.verifiedTrades.length,1);
 assert.equal(result.verifiedTrades[0].pnl,-10);
});
test('B66 adaptive suggestion requires 5 verified broker outcomes, no forced switch',()=>{
 const rows=Array.from({length:5},(_,i)=>({
  ...event('trade-'+i,'closed_trade','broker_confirmed',-500),
  observed_at:new Date(Date.UTC(2026,9,19,1,i,0)).toISOString()
 }));
 const evidence=summarizeVerifiedRisk(rows);
 assert.equal(evidence.verifiedTrades.length,5);
 assert.match(adaptiveModeSuggestion(evidence.verifiedTrades,'manual'),/Considere pausar/);
 assert.equal(adaptiveModeSuggestion(evidence.verifiedTrades,'reversa'),null);
});
test('B66 read-only risk query enforces user identity and returns evidence',async()=>{
 const rows=[event('one')];let filtered='';
 const query={
   select(){return query;},
   eq(field,value){assert.equal(field,'user_id');filtered=value;return query;},
   order(){return query;},
   async limit(n){assert.equal(n,100);return {data:rows,error:null};}
 };
 const db={from(table){assert.equal(table,RISK_TABLE);return query;}};
 const r=await loadVerifiedRiskSummary(db,{id:'user-1'});
 assert.equal(filtered,'user-1');assert.equal(r.verifiedBlocks,1);
});
test('B66 risk source errors do not create zero success',async()=>{
 const query={
   select(){return query;},eq(){return query;},order(){return query;},
   async limit(){return {data:null,error:{message:'offline'}};}
 };
 const db={from(){return query;}};
 await assert.rejects(()=>loadVerifiedRiskSummary(db,{id:'A'}),{status:503});
});
test('B66 risk client rejects verified data after account changes',async()=>{
 let who='A';const auth={auth:{async getSession(){return{data:{session:{user:{id:who},access_token:'T'}}};}}};
 const s=await loadAccountRisk(auth,async()=>{who='B';return{ok:true,json:async()=>({
  verifiedBlocks:2,paperBlocks:0,verifiedTrades:[],avoidedLossBRL:null,evidenceStatus:'broker_evidence'
 })};});
 assert.equal(s.verifiedBlocks,null);assert.equal(s.userId,null);
});
test('B66 risk client ignores fabricated monetary savings',async()=>{
 const auth={auth:{async getSession(){return{data:{session:{user:{id:'A'},access_token:'T'}}};}}};
 const s=await loadAccountRisk(auth,async()=>({ok:true,json:async()=>({
   verifiedBlocks:2,paperBlocks:0,verifiedTrades:[],avoidedLossBRL:999,evidenceStatus:'broker_evidence'
 })}));
 assert.equal(s.avoidedLossBRL,null);assert.equal(s.verifiedBlocks,null);
});
test('B66 cannot share Platform DB credentials with Social/Pay',()=>{
 assert.throws(()=>getJeniosPlatformAdmin({NEXT_PUBLIC_SUPABASE_URL:'https://social.example',SUPABASE_SERVICE_ROLE_KEY:'social-secret'}),{status:503});
});
test('B66 UI shows the honest audit and reads shared journal',()=>{
 const d=readFileSync(new URL('../app/dashboard/page.js',import.meta.url),'utf8');
 const m=readFileSync(new URL('../app/mesa-operacoes/page.js',import.meta.url),'utf8');
 assert.match(d,/appendSimIntention/);assert.match(m,/appendSimIntention/);
 assert.match(d,/readSimJournal/);assert.match(m,/readSimJournal/);
 assert.match(m,/riskEvidence.verifiedTrades/);
 assert.doesNotMatch(d,/R\$ 6\.293,00|17 operações impulsivas evitadas/);
});
test('B66 risk evidence requires service-only database migration',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019023000_platform_risk_evidence_cp66.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant select,insert .* to service_role/);
 assert.doesNotMatch(sql,/grant select .* to authenticated/);
});
