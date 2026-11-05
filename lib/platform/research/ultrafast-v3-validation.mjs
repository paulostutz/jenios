/** R112 / Block 3 — independent walk-forward and conservative resampling.
 * This is evidence scoring, not a profit guarantee or strategy promotion.
 */
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const round=x=>Number(x.toFixed(8));
function rng(seed){let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function mean(xs){return xs.reduce((a,b)=>a+b,0)/xs.length;}
function safeTrades(rows,fold,allowBaseline){
 if(!Array.isArray(rows)||rows.length<30||rows.length>20000)fail('R112_EVIDENCE_INSUFFICIENT_SAMPLE');
 let previous=-1;
 for(const t of rows){
   if(!t||!Number.isSafeInteger(t.signalAtMs)||!Number.isSafeInteger(t.entryAtMs)||
      !Number.isSafeInteger(t.exitAtMs)||!finite(t.netPnlBps)||!finite(t.costBps)||t.costBps<0||
      t.signalAtMs<fold.testStartMs||t.entryAtMs<=t.signalAtMs||t.exitAtMs<t.entryAtMs||
      t.exitAtMs>fold.testEndMs||t.signalAtMs<previous)
      fail('R112_EVIDENCE_LOOKAHEAD_OR_ORDER');
   previous=t.signalAtMs;
 }
 return rows;
}
/** Paired out-of-sample samples, signed after costs, one or more candidates.
 * Bonferroni-adjusted block-bootstrap percentile lower bound. Results can be
 * sensitive to sample dependence, regime shifts and how hypotheses were selected.
 */
export function evaluateUltraCandidateHoldout({folds,candidates,bootstrapSamples=500,
  alpha=0.05,seed=0x11223344,minEmbargoMs=60000,operatorApproved=false}={}){
 if(!Array.isArray(folds)||folds.length<1||folds.length>12||
    !Array.isArray(candidates)||candidates.length<1||candidates.length>20||
    !Number.isSafeInteger(bootstrapSamples)||bootstrapSamples<200||bootstrapSamples>2000||
    !finite(alpha)||alpha<0.001||alpha>.1||!Number.isSafeInteger(seed)||
    !Number.isSafeInteger(minEmbargoMs)||minEmbargoMs<0||
    typeof operatorApproved!=='boolean')fail('R112_EVIDENCE_INVALID_INPUT');
 const candidateNames=new Set(candidates.map(c=>c.id));
 if(candidateNames.size!==candidates.length||[...candidateNames].some(s=>typeof s!=='string'||!/^[a-z0-9_-]{2,40}$/i.test(s)))
   fail('R112_EVIDENCE_INVALID_CANDIDATE');
 let lastFoldEnd=-1;
 const seenTimes=[];
 const comparisons=Object.fromEntries(candidates.map(c=>[c.id,[]]));
 for(let i=0;i<folds.length;i++){
   const f=folds[i];
   if(!f||!Number.isSafeInteger(f.trainEndMs)||!Number.isSafeInteger(f.testStartMs)||
      !Number.isSafeInteger(f.testEndMs)||f.testStartMs<=f.trainEndMs+minEmbargoMs||
      f.testEndMs<=f.testStartMs||f.testStartMs<=lastFoldEnd)
      fail('R112_EVIDENCE_FOLD_LEAKAGE');
   lastFoldEnd=f.testEndMs;
   const baseline=safeTrades(f.baselineTrades,f);
   seenTimes.push(...baseline.map(t=>t.signalAtMs));
   for(const c of candidates){
     const row=c.folds?.[i];
     const trials=safeTrades(row?.trades,f);
     if(trials.length!==baseline.length)fail('R112_EVIDENCE_UNPAIRED_SAMPLE');
     const out=comparisons[c.id];
     for(let k=0;k<trials.length;k++){
       if(trials[k].signalAtMs!==baseline[k].signalAtMs)fail('R112_EVIDENCE_UNPAIRED_SAMPLE');
       out.push(trials[k].netPnlBps-baseline[k].netPnlBps);
     }
   }
 }
 const rows=[];const adjustedAlpha=alpha/candidates.length;
 for(let index=0;index<candidates.length;index++){
   const c=candidates[index],differences=comparisons[c.id],
     n=differences.length,block=Math.max(2,Math.floor(Math.sqrt(n)));
   const random=rng((seed+index*1337)>>>0),bootstrap=[];
   for(let b=0;b<bootstrapSamples;b++){
     let value=0,done=0;
     while(done<n){
       const offset=Math.floor(random()*n);
       for(let j=0;j<block&&done<n;j++,done++)value+=differences[(offset+j)%n];
     }
     bootstrap.push(value/n);
   }
   bootstrap.sort((a,b)=>a-b);
   const lower=bootstrap[Math.max(0,Math.floor((adjustedAlpha/2)*bootstrap.length))];
   const upper=bootstrap[Math.min(bootstrap.length-1,Math.ceil((1-adjustedAlpha/2)*bootstrap.length)-1)];
   const edge=mean(differences);
   rows.push(Object.freeze({candidateId:c.id,pairedSamples:n,
      avgNetOutperformanceBps:round(edge),lowerBoundBps:round(lower),
      upperBoundBps:round(upper),passStatisticalResearchGate:lower>0&&edge>0,
      adjustedAlpha:round(adjustedAlpha),
      bootstrapBlockLength:block,statisticalMethod:'BLOCK_BOOTSTRAP_BONFERRONI_EXPLORATORY'}));
 }
 const passing=rows.filter(r=>r.passStatisticalResearchGate);
 return Object.freeze({schema:'JENIOS_R112_WALK_FORWARD_V1',foldCount:folds.length,
  comparisons:Object.freeze(rows),passingCandidateIds:Object.freeze(passing.map(r=>r.candidateId)),
  candidateCount:candidates.length,tradeCount:seenTimes.length,operatorApproved,
  recommendation:'HUMAN_REVIEW_ONLY',modelPromoted:false,
  actualBrokerPnl:null,financialPerformanceCertified:false,
  noLiveOrderAuthorization:true,ordersSent:0});
}