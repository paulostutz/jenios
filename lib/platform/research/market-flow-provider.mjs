/** Public read-only collector. Refresh outside the Ultra decision path. No keys or orders. */
import {readBoundedJson} from '../bounded-response.mjs';
import {getWhaleTransfers} from '../../whale-transfers.mjs';
import {buildMarketFlowContext,unavailableFlow} from './market-flow-context.mjs';
export function createMarketFlowProvider({fetchImpl=fetch,clock=Date.now,whaleReader=getWhaleTransfers}={}){
 let cached=null,inFlight=null,nextRefreshAt=0;
 async function refresh(){
   if(clock()<nextRefreshAt&&cached)return cached;
   if(inFlight)return inFlight;
   inFlight=(async()=>{
     const endMs=clock(),startMs=endMs-60000;
     try{
       // Shared monitor already owns its cache. Its failure is not interpreted as zero flow.
       const whalesPromise=Promise.resolve().then(()=>whaleReader()).catch(()=>null);
       const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
       let trades=[],complete=false;
       try{
         let fromId=null;
         for(let page=0;page<12;page++){
           const url=new URL('https://data-api.binance.vision/api/v3/aggTrades');
           url.searchParams.set('symbol','BTCUSDT');url.searchParams.set('limit','1000');
           if(fromId===null){url.searchParams.set('startTime',String(startMs));url.searchParams.set('endTime',String(endMs));}
           else url.searchParams.set('fromId',String(fromId));
           const response=await fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',signal:controller.signal});
           if(!response.ok)throw Error('FLOW_PROVIDER_UNAVAILABLE');
           const rows=await readBoundedJson(response,512000);
           if(!Array.isArray(rows)||rows.length>1000)throw Error('FLOW_PROVIDER_INVALID');
           // Validate every returned row, including the page portion after our cutoff.
           if(rows.some((r,i)=>!r||!Number.isSafeInteger(r.a)||!Number.isSafeInteger(r.T)||
             (i>0&&(r.a<=rows[i-1].a||r.T<rows[i-1].T))||(fromId!==null&&r.a<fromId)))
             throw Error('FLOW_PROVIDER_SEQUENCE_INVALID');
           const eligible=rows.filter(r=>r.T<=endMs);trades.push(...eligible);
           if(rows.some(r=>r.T>endMs)||rows.length<1000){complete=true;break;}
           fromId=rows.at(-1).a+1;
         }
       }finally{clearTimeout(timer);}
       // Do not delay the snapshot indefinitely if the legacy monitor is slow.
       let timeout;
       const whales=await Promise.race([whalesPromise,new Promise(resolve=>{timeout=setTimeout(()=>resolve(null),1000);})]);
       clearTimeout(timeout);
       cached=buildMarketFlowContext({trades,startMs,endMs,receivedAtMs:clock(),complete,whales});
     }catch{cached=unavailableFlow('PUBLIC_FLOW_UNAVAILABLE',clock());}
     nextRefreshAt=clock()+5000;
     return cached;
   })();
   try{return await inFlight;}finally{inFlight=null;}
 }
 return Object.freeze({refresh,read:()=>cached});
}
export const marketFlowProvider=createMarketFlowProvider();
