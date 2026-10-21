/** B243: interpret existing account revocation and disappearing order snapshots conservatively. */
import {reconcileDemoSnapshots} from '../connections/demo-reconciliation.mjs';
export function inspectCustomerReadRevocation({connection,previousSnapshot,currentSnapshot}){
 if(!connection||connection.status!=='active'||connection.revoked===true||
    !['paper','testnet'].includes(connection.environment)){
  return Object.freeze({schema:'JENIOS_B243_REVOKED_ACCOUNT_REVIEW',
    state:'REVOKED_OR_UNAVAILABLE',readOnlyConnectionCanRefresh:false,
    providerKeyRevokedAtBroker:false,positionClosed:false,brokerOrdersCancelled:false,
    ordersSent:0,liveExecution:false});
 }
 const report=reconcileDemoSnapshots(previousSnapshot,currentSnapshot);
 if(report.provider!==connection.provider||report.environment!==connection.environment)
  throw Error('B243_CUSTOMER_SCOPE_MISMATCH');
 return Object.freeze({schema:'JENIOS_B243_REVOKED_ACCOUNT_REVIEW',state:report.reviewRequired?'REVIEW_REQUIRED':'READ_ONLY_OBSERVATION',
  missingOpenOrders:report.orders.missing.length,
  missingPositions:report.positions.missing.length,
  missingDoesNotImplyFill:report.missingMeansFilled===false,
  missingDoesNotImplyClose:report.missingMeansClosed===false,
  providerKeyRevokedAtBroker:false,positionClosed:false,brokerOrdersCancelled:false,
  ordersSent:0,liveExecution:false});
}
