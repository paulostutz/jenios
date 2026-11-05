/** Admin-only UltraFast V2/V3 research. No exchange authentication or order transport. */
import {getJeniosPlatformAdmin} from '../../../../../../lib/platform/admin-db.mjs';
import {requirePlatformAdmin} from '../../../../../../lib/platform/admin-permissions.mjs';
import {analyzeUltraV2WithCertifiedHistory} from '../../../../../../lib/platform/research/ultrafast-v2-certified-bridge.mjs';
import {runUltraR113Laboratory} from '../../../../../../lib/platform/research/ultrafast-r113-laboratory.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization',
 'X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers:HEADERS});
const scope=()=>{
 const env=process.env;
 return env.VERCEL_ENV==='production'&&
   env.VERCEL_PROJECT_ID==='prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'&&
   env.VERCEL_GIT_COMMIT_REF==='release/jenios-genios-g44-20261024';
};
async function authorize(request){
 if(!scope())throw Object.assign(Error('DISABLED'),{status:404});
 if(!/^Bearer [^\s]+$/i.test(request.headers.get('authorization')||''))
  throw Object.assign(Error('NO_SESSION'),{status:401});
 const db=getJeniosPlatformAdmin();
 await requirePlatformAdmin(request,db,'platform.admin');
 return true;
}
const errorReply=e=>reply({ok:false,error:e?.status===401?'Entre na JENIOS Platform.':
 e?.status===403?'Você não possui permissão administrativa.':
 e?.status===404?'O laboratório está indisponível neste ambiente.':
 e?.status===400?'Parâmetros inválidos.':'Não foi possível concluir a consulta.'},
 [400,401,403,404].includes(e?.status)?e.status:503);
export async function POST(request){
 try{
  if(request.method!=='POST')return reply({ok:false,error:'Método não permitido.'},405);
  await authorize(request);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({ok:false,error:'Origem não autorizada.'},403);
  const length=Number(request.headers.get('content-length')||0);
  if(length>1024)return reply({ok:false,error:'Requisição muito grande.'},413);
  const raw=await request.text();
  if(raw.length>1024)return reply({ok:false,error:'Requisição muito grande.'},413);
  let body;
  try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'JSON inválido.'},400);}
  if(!body||!['favorable','risk','stale'].includes(body.scenario)||
    Object.keys(body).some(k=>k!=='scenario'))return reply({ok:false,error:'Cenário desconhecido.'},400);
  const result=runUltraR113Laboratory(body.scenario,
    {nowMs:Date.now(),analyzeV2:analyzeUltraV2WithCertifiedHistory});
  return reply({ok:true,...result});
 }catch(e){return errorReply(e);}
}

/** Snapshot public REST ticker: not an order-book feed or trading signal. */
export async function GET(request){
 try{
  if(request.method!=='GET')return reply({ok:false,error:'Método não permitido.'},405);
  await authorize(request);
  if(new URL(request.url).search)return reply({ok:false,error:'Sem parâmetros de consulta.'},400);
  const response=await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD',
    {cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500)});
  if(!response.ok)return reply({ok:false,error:'Cotações públicas indisponíveis no momento.'},503);
  const payload=await response.json();
  if(!payload||!Array.isArray(payload.error)||payload.error.length||!payload.result||
    typeof payload.result!=='object')return reply({ok:false,error:'Dados públicos não confirmados.'},503);
  const results=payload.result;
  const labels=[['BTC/USD',['XXBTZUSD','XBTUSD']],['ETH/USD',['XETHZUSD','ETHUSD']],['SOL/USD',['SOLUSD','SOLZUSD']]];
  const markets=[];
  for(const [symbol,keys] of labels){
    const raw=keys.map(k=>results[k]).find(Boolean);
    if(!raw)continue;
    const bid=Number(raw.b?.[0]),ask=Number(raw.a?.[0]),last=Number(raw.c?.[0]);
    const volume24h=Number(raw.v?.[1]),trades24h=Number(raw.t?.[1]);
    if(!Number.isFinite(bid)||bid<=0||!Number.isFinite(ask)||ask<bid||
       !Number.isFinite(last)||last<=0)continue;
    const spreadBps=(ask-bid)/((ask+bid)/2)*10000;
    markets.push({symbol,bid,ask,last,spreadBps:Number(spreadBps.toFixed(4)),
      volume24h:Number.isFinite(volume24h)?volume24h:null,
      trades24h:Number.isSafeInteger(trades24h)?trades24h:null});
  }
  if(!markets.length)return reply({ok:false,error:'Sem pares públicos validados.'},503);
  return reply({ok:true,schema:'JENIOS_R113_PUBLIC_TICKER_OBSERVATION_V1',
    dataType:'PUBLIC_REST_TICKER_NOT_L2_NOT_REALTIME_TRADE_SIGNAL',
    source:'KRAKEN_PUBLIC_REST_READONLY',observedAt:new Date().toISOString(),markets,
    marketDataIsSampled:true,authenticatedExchangeConnection:false,
    externalPaperEnabled:false,liveExecutionEnabled:false,ordersSent:0});
 }catch(e){return errorReply(e);}
}