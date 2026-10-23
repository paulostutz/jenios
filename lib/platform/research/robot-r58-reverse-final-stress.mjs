/**
 * R58 — Reverse mode final selective-reversal stress + synthetic losseshometro.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function evaluateR58Reverse({
 operatorSide,technicalSide,confidence,megaTrend=false,lossStreak=0,syntheticLossIfFollowedR=0
}={}){
 if(!['buy','sell'].includes(operatorSide)||!['buy','sell'].includes(technicalSide)||
   typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1||
   typeof megaTrend!=='boolean'||!Number.isSafeInteger(lossStreak)||lossStreak<0||
   typeof syntheticLossIfFollowedR!=='number'||!Number.isFinite(syntheticLossIfFollowedR)||syntheticLossIfFollowedR<0)
   fail('R58_INVALID_INPUT');
 const disagreement=operatorSide!==technicalSide;
 const reasons=[];
 if(megaTrend)reasons.push('MEGATREND_EXCEPTION');
 if(!disagreement)reasons.push('NO_MATERIAL_DISAGREEMENT');
 if(confidence<.65)reasons.push('LOW_CONFIDENCE');
 const reverseReference=reasons.length===0;
 const suggestReverseMode=lossStreak>=3&&disagreement&&confidence>=.65&&!megaTrend;
 const hypotheticalLossAvoidedR=reverseReference?syntheticLossIfFollowedR:0;
 return Object.freeze({
   reverseReference,
   suggestedSide:reverseReference?technicalSide:operatorSide,
   suggestReverseMode,
   reasons:Object.freeze(reasons),
   hypotheticalLossAvoidedR:Number(hypotheticalLossAvoidedR.toFixed(6)),
   actualLossesAvoided:null,
   actualBrokerPnl:null,realTradeAccuracy:null,
   ordersSent:0,paperOrdersSent:0
 });
}
export function runR58Battery(){
 const normal=evaluateR58Reverse({operatorSide:'buy',technicalSide:'sell',confidence:.85,megaTrend:false,lossStreak:4,syntheticLossIfFollowedR:1.2});
 const mega=evaluateR58Reverse({operatorSide:'buy',technicalSide:'sell',confidence:.95,megaTrend:true,lossStreak:8,syntheticLossIfFollowedR:2});
 const aligned=evaluateR58Reverse({operatorSide:'sell',technicalSide:'sell',confidence:.9,megaTrend:false,lossStreak:4,syntheticLossIfFollowedR:1});
 const low=evaluateR58Reverse({operatorSide:'buy',technicalSide:'sell',confidence:.55,megaTrend:false,lossStreak:5,syntheticLossIfFollowedR:1});
 return Object.freeze({
   selectiveReversalWorks:normal.reverseReference===true,
   lossStreakCanSuggestMode:normal.suggestReverseMode===true,
   megatrendNeverReversed:mega.reverseReference===false&&mega.suggestReverseMode===false,
   alignedOperatorNotReversed:aligned.reverseReference===false,
   lowConfidenceNotReversed:low.reverseReference===false,
   syntheticLosseshometroOnly:normal.hypotheticalLossAvoidedR>0&&normal.actualLossesAvoided===null,
   pass:normal.reverseReference===true&&normal.suggestReverseMode===true&&mega.reverseReference===false&&
     aligned.reverseReference===false&&low.reverseReference===false&&normal.actualLossesAvoided===null,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,ordersSent:0,paperOrdersSent:0
 });
}