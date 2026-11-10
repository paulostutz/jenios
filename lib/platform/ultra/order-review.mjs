/** Review boundary for a future authenticated executor. It does not send orders.
 * The acknowledgement is specific to one immutable order, not blanket risk consent.
 * Callers must load the review from a server-owned durable record, never client JSON.
 */
import {createHash} from 'node:crypto';
import {ultraOperationalBlockers} from './policy.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function reviewUltraOrder({ownerId,connectionId,order,account,technicalState,nowMs}){
 if(typeof ownerId!=='string'||!ownerId||typeof connectionId!=='string'||!connectionId||!Number.isSafeInteger(nowMs))throw Error('ULTRA_REVIEW_IDENTITY_REQUIRED');
 if(!order||!['b3','crypto','forex'].includes(order.market)||typeof order.symbol!=='string'||!order.symbol||!['buy','sell'].includes(order.side)||typeof order.currency!=='string')throw Error('ULTRA_ORDER_INVALID');
 if([order.notional,order.leverage,account?.allocatedCapital,account?.equity].some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0)||order.leverage<1)throw Error('ULTRA_ORDER_INVALID');
 const payload={ownerId,connectionId,market:order.market,symbol:order.symbol,side:order.side,currency:order.currency,
  notional:order.notional,leverage:order.leverage,allocatedCapital:account.allocatedCapital,equity:account.equity,
  reviewedAtMs:nowMs,expiresAtMs:nowMs+60000};
 const projectedLoss5Pct=order.notional*.05;
 return {...payload,reviewDigest:digest(payload),projectedLoss5Pct,
  requiresAcknowledgement:order.leverage>=10||projectedLoss5Pct>=account.allocatedCapital*.25,
  technicalBlockers:ultraOperationalBlockers(technicalState),ordersSent:0};
}
export function authorizeUltraReview(review,{acknowledgement,ownerId,connectionId,nowMs,technicalState}){
 if(!review||review.ownerId!==ownerId||review.connectionId!==connectionId||!Number.isSafeInteger(nowMs)||nowMs<review.reviewedAtMs||nowMs>=review.expiresAtMs)throw Error('ULTRA_REVIEW_EXPIRED_OR_CHANGED');
 const rebuilt=reviewUltraOrder({ownerId,connectionId,order:{market:review.market,symbol:review.symbol,side:review.side,currency:review.currency,notional:review.notional,leverage:review.leverage},account:{allocatedCapital:review.allocatedCapital,equity:review.equity},technicalState,nowMs:review.reviewedAtMs});
 if(rebuilt.reviewDigest!==review.reviewDigest||rebuilt.expiresAtMs!==review.expiresAtMs||rebuilt.requiresAcknowledgement!==review.requiresAcknowledgement||!Array.isArray(review.technicalBlockers))throw Error('ULTRA_REVIEW_EXPIRED_OR_CHANGED');
 const blockers=ultraOperationalBlockers(technicalState);
 if(blockers.length||review.technicalBlockers.length)return {decision:'TECHNICAL_BLOCK',blockers:[...new Set([...blockers,...review.technicalBlockers])],ordersSent:0};
 if(rebuilt.requiresAcknowledgement&&(!acknowledgement||acknowledgement.reviewDigest!==rebuilt.reviewDigest||acknowledgement.accepted!==true))return {decision:'AWAITING_RISK_ACKNOWLEDGEMENT',ordersSent:0};
 return {decision:'REVIEW_ACCEPTED',requiresAtomicReservation:true,requiresFreshBrokerPreflight:true,
  requiresSingleUseConsumption:true,reviewDigest:review.reviewDigest,ordersSent:0};
}
