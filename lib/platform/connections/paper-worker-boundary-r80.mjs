/** R80: explicit private composition boundary. This module is not exposed by HTTP.
 * The trusted worker must supply a durable safety store, approval store and ledger.
 * It does not start a worker or make a broker connection.
 */
import {requireR80PaperSafety} from './paper-safety-gate-r80.mjs';
import {submitAlpacaPaperOnce} from './alpaca-paper-private-transport-r77.mjs';
import {submitSignedR78PaperOnce} from './paper-signed-authorization-r78.mjs';
export async function submitR80GuardedPaperOnce(input,{
 safetyStore,approvalStore,ledger,env=process.env,paperExecutor,fetcher,reader,clock=Date.now
}={}){
 const {permit,session,storedConnection,order,nowMs}=input||{};
 const safetyScope={ownerUserId:permit?.ownerUserId,connectionId:permit?.connectionId,
  clientOrderId:permit?.clientOrderId,nowMs,order};
 if(!permit||!session||!storedConnection||!order||
    session.userId!==permit.ownerUserId||storedConnection.id!==permit.connectionId||
    order.clientOrderId!==permit.clientOrderId)
  throw Object.assign(new Error('R80_SCOPE_MISMATCH'),{code:'R80_SCOPE_MISMATCH'});
 await requireR80PaperSafety(safetyScope,{store:safetyStore,env});
 const recheck=()=>requireR80PaperSafety({...safetyScope,nowMs:Math.max(nowMs,clock())},
  {store:safetyStore,env});
 // Defense in depth: check after the atomic R79 claim and immediately before POST.
 // A kill cannot unsend a POST already accepted by Alpaca; such orders require reconciliation.
 const wrappedFetcher=async (url,options)=>{
  if(options?.method==='POST')await recheck();
  return (fetcher||fetch)(url,options);
 };
 const wrappedExecutor=async (payload,deps)=>{
  await recheck();
  return (paperExecutor||submitAlpacaPaperOnce)(payload,deps);
 };
 return submitSignedR78PaperOnce(input,{
   approvalStore,ledger,env,paperExecutor:wrappedExecutor,fetcher:wrappedFetcher,reader
 });
}
