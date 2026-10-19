/** R45-B91 — audit of locally captured, forward-only public-market observations.
 * These are NOT trusted timestamps or independently witnessed forward samples.
 * Never upgrade browser storage to real robot evidence or a live market feed.
 */
const utc=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const safeNumber=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function auditLocalProspectiveCohort(rows,{granularity=300,now=Date.now()}={}){
 const fail=(code,index=null)=>Object.freeze({valid:false,code,index,count:0,
  paperReviewReady:false,externalProvenanceVerified:false,independentTimestampVerified:false,
  robotPerformanceCertified:false,realExecutionAllowed:false});
 if(![60,300,3600].includes(granularity)||!Number.isFinite(now))return fail('INVALID_GRANULARITY_OR_CLOCK');
 if(!Array.isArray(rows)||rows.length===0||rows.length>120)return fail('INVALID_COHORT_SIZE');
 let lastRecord=-Infinity,lastCandle=-Infinity,minLatency=Infinity,maxLatency=0;
 let minPrice=Infinity,maxPrice=0;
 const interval=granularity*1000;
 const timestamps=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i],at=utc(r?.recordedAt),candle=utc(r?.candleAt);
  if(!r||r.source!=='browser_public_candle_capture'||r.realOrder!==false||
   r.verifiedProfit!==null||!safeNumber(r.close)||!Number.isFinite(at)||
   !Number.isFinite(candle)||at>now+5000||candle>=at||at<=lastRecord||
   candle<=lastCandle||at-candle>interval*7)
   return fail('INVALID_OR_REORDERED_CAPTURE',i);
  const latency=at-candle;
  minLatency=Math.min(minLatency,latency);maxLatency=Math.max(maxLatency,latency);
  minPrice=Math.min(minPrice,r.close);maxPrice=Math.max(maxPrice,r.close);
  timestamps.push({at,candle});
  lastRecord=at;lastCandle=candle;
 }
 const spanMs=lastRecord-timestamps[0].at;
 const coveredBuckets=Math.max(1,Math.floor((lastCandle-timestamps[0].candle)/interval)+1);
 const missingBuckets=coveredBuckets-rows.length;
 // A gap may reflect manual observation frequency, not missing provider bars.
 const warnings=[];
 if(missingBuckets>0)warnings.push('Há candles não observados entre os registros manuais.');
 if(spanMs<3600000)warnings.push('A janela observada é curta para uma análise prospectiva.');
 if(rows.length<12)warnings.push('Quantidade de observações insuficiente para revisão comparativa.');
 if(maxLatency>interval*4)warnings.push('Parte das observações foi registrada com atraso.');
 const paperReviewReady=rows.length>=12&&spanMs>=3600000&&missingBuckets<=coveredBuckets*0.5;
 return Object.freeze({
  valid:true,count:rows.length,windowHours:Number((spanMs/3600000).toFixed(2)),
  minLatencySeconds:Number((minLatency/1000).toFixed(1)),
  maxLatencySeconds:Number((maxLatency/1000).toFixed(1)),
  firstRecordedAt:new Date(timestamps[0].at).toISOString(),
  lastRecordedAt:new Date(lastRecord).toISOString(),
  coveredBuckets,missingBuckets,lowestObservedClose:minPrice,highestObservedClose:maxPrice,
  warnings,paperReviewReady,
  externalProvenanceVerified:false,independentTimestampVerified:false,
  robotPerformanceCertified:false,realExecutionAllowed:false,
  meaning:'Apenas série local descritiva. Sem servidor testemunhando o instante original, não há prova independente de prospectividade.'
 });
}
export function prospectiveReadinessLabel(audit){
 if(!audit?.valid)return 'Revisão indisponível: registros locais inválidos.';
 if(!audit.paperReviewReady)return 'Amostra local em formação. Não há evidência de desempenho.';
 return 'Amostra local suficiente para revisão educativa, não para certificação de robôs.';
}
