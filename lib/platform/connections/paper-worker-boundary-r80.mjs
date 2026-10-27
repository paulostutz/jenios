/** R80: explicit private composition boundary. This module is not exposed by HTTP.
 * The trusted worker must supply a durable safety store, approval store and ledger.
 * It does not start a worker or make a broker connection.
 */
import {requireR80PaperSafety} from './paper-safety-gate-r80.mjs';
import {submitSignedR78PaperOnce} from './paper-signed-authorization-r78.mjs';
export async function submitR80GuardedPaperOnce(input,{
 safetyStore,approvalStore,ledger,env=process.env,paperExecutor,fetcher,reader
}={}){
 const {permit,session,storedConnection,order,nowMs}=input||{};
 if(!permit||!session||!storedConnection||!order||
    session.userId!==permit.ownerUserId||storedConnection.id!==permit.connectionId||
    order.clientOrderId!==permit.clientOrderId)
  throw Object.assign(new Error('R80_SCOPE_MISMATCH'),{code:'R80_SCOPE_MISMATCH'});
 await requireR80PaperSafety({ownerUserId:permit.ownerUserId,
   connectionId:permit.connectionId,clientOrderId:permit.clientOrderId,nowMs},
   {store:safetyStore,env});
 return submitSignedR78PaperOnce(input,{
   approvalStore,ledger,env,paperExecutor,fetcher,reader
 });
}
