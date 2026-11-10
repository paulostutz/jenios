import {initialOperation,validateOperation,OPERATION_STATES} from './operation.mjs';
import {workspaceReportViewR125} from './client/report-r125.mjs';

/** UI fixtures only. Never sent to telemetry, an account, or a billing service. */
export const REHEARSAL_ROUTES=Object.freeze([
 {id:'mt5',label:'Mini índice / mini dólar · MT5',provider:'mt5',market:'b3',currency:'BRL',symbol:'FIXTURE_WIN'},
 {id:'profit',label:'Mini índice / mini dólar · Profit',provider:'profit',market:'b3',currency:'BRL',symbol:'FIXTURE_WDO'},
 {id:'binance',label:'Cripto · Binance',provider:'binance',market:'crypto',currency:'USDT',symbol:'FIXTURE_CRYPTO'}
]);
export {OPERATION_STATES};
export function rehearsalReport(routeId,now=new Date()){
 const route=REHEARSAL_ROUTES.find(r=>r.id===routeId);
 if(!route||!Number.isFinite(now.getTime()))throw Error('INVALID_REHEARSAL_ROUTE');
 const time=now.toISOString();
 const operations=Object.keys(OPERATION_STATES).map((state,index)=>{
  const base=initialOperation({market:route.market,symbol:route.symbol,currency:route.currency,side:'buy',quantity:'2'},`FIXTURE_R126_${route.id}_${index}`,now.getTime());
  const filled=['open','partially_closed','closed'].includes(state),exit=['partially_closed','closed'].includes(state);
  return validateOperation({...base,state,openedAt:filled?time:null,closedAt:state==='closed'?time:null,
   entryQuantity:filled?'2':'0',exitQuantity:state==='closed'?'2':exit?'1':'0',entryPrice:filled?'10':null,exitPrice:exit?'10.1':null,
   gross:state==='closed'?'0.2':null,fees:state==='closed'?'0.01':null,financing:state==='closed'?'0':null,costsComplete:state==='closed',
   brokerRefs:filled?[`FIXTURE_ONLY_${index}`]:[],reason:state==='unknown'?'FIXTURE_RESPONSE_UNKNOWN':state==='rejected'?'FIXTURE_REJECTED':null},{market:route.market,now:now.getTime()});
 });
 // The second closed fixture deliberately has no confirmed costs and must not
 // appear in definitive totals, despite having an apparent gross gain.
 operations.push({...operations.find(o=>o.state==='closed'),id:`FIXTURE_R126_${route.id}_costs_pending`,gross:'9000',fees:null,financing:null,costsComplete:false,reason:'COSTS_PENDING'});
 const report={schema:'JENIOS_ULTRA_OPERATIONS_V1',provider:route.provider,environment:'demo',connectionLabel:'EXEMPLO FICTÍCIO · '+route.label,generatedAt:time,operations};
 return {route,report,view:workspaceReportViewR125(report,{period:'all',now}),
  evidence:'synthetic_ui_fixture_only',ordersSentToBroker:0,accountConnected:false,liveExecutionEnabled:false,billingEnabled:false};
}
