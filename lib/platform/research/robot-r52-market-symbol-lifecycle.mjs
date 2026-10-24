/**
 * R52 — exchange maintenance / halt / delisting / relisting lifecycle.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function evaluateR52Lifecycle(x){
 if(!x||!['open','maintenance','halted','closed'].includes(x.marketStatus)||
   !['online','halted','delisted','relisted','unknown'].includes(x.symbolStatus)||
   typeof x.hasOpenExposure!=='boolean'||typeof x.accountReconciled!=='boolean'||
   typeof x.marketDataResynced!=='boolean')fail('R52_INVALID_INPUT');
 const reasons=[];
 if(x.marketStatus!=='open')reasons.push('MARKET_NOT_OPEN');
 if(x.symbolStatus!=='online')reasons.push('SYMBOL_NOT_ONLINE');
 if(!x.accountReconciled)reasons.push('ACCOUNT_NOT_RECONCILED');
 if(!x.marketDataResynced)reasons.push('MARKETDATA_NOT_RESYNCED');
 if(x.symbolStatus==='delisted'&&x.hasOpenExposure)reasons.push('ORPHAN_EXPOSURE_REVIEW_REQUIRED');
 return Object.freeze({
   allowNewEntries:reasons.length===0,
   closeOnly:x.hasOpenExposure&&reasons.length>0,
   reasons:Object.freeze(reasons),
   ordersSent:0,paperOrdersSent:0
 });
}
export function runR52Battery(){
 const maintenance=evaluateR52Lifecycle({marketStatus:'maintenance',symbolStatus:'online',hasOpenExposure:false,accountReconciled:true,marketDataResynced:true});
 const delisted=evaluateR52Lifecycle({marketStatus:'open',symbolStatus:'delisted',hasOpenExposure:true,accountReconciled:true,marketDataResynced:true});
 const relistedNotReady=evaluateR52Lifecycle({marketStatus:'open',symbolStatus:'relisted',hasOpenExposure:false,accountReconciled:false,marketDataResynced:false});
 const ready=evaluateR52Lifecycle({marketStatus:'open',symbolStatus:'online',hasOpenExposure:false,accountReconciled:true,marketDataResynced:true});
 return Object.freeze({
   maintenanceBlocks:!maintenance.allowNewEntries,
   delistedExposureCloseOnly:delisted.closeOnly&&!delisted.allowNewEntries,
   relistRequiresFullReconcile:!relistedNotReady.allowNewEntries,
   cleanOnlineAllows:ready.allowNewEntries,
   pass:!maintenance.allowNewEntries&&delisted.closeOnly&&!relistedNotReady.allowNewEntries&&ready.allowNewEntries,
   actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}