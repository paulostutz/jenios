/** Read-only view of the existing localReport exported by OperationLedger.
 * One imported file is one connection/environment. No wallets, credentials,
 * commands, persistence or proof of current account connectivity.
 */
import {validateOperation,operationNet} from '../operation.mjs';
import {decimal8,format8} from './reporting.mjs';
import {ultraPeriodStart} from '../reporting.mjs';
const allowed = ['schema','provider','environment','connectionLabel','generatedAt','operations','accountFingerprint'];
export function parseWorkspaceReport(input, now = Date.now()) {
  const validTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  if (!input || Array.isArray(input) || ![6,7].includes(Object.keys(input).length) || Object.keys(input).some(k=>!allowed.includes(k)) || (Object.hasOwn(input,'accountFingerprint')&&!(typeof input.accountFingerprint==='string'&&/^[a-f0-9]{64}$/.test(input.accountFingerprint))) || input.schema !== 'JENIOS_ULTRA_OPERATIONS_V1' || !['profit','binance','mt5'].includes(input.provider) || !['demo','live'].includes(input.environment) || typeof input.connectionLabel !== 'string' || !input.connectionLabel.trim() || input.connectionLabel.length > 80 || !validTime(input.generatedAt) || Date.parse(input.generatedAt) > now + 300000 || !Array.isArray(input.operations) || input.operations.length > 20000) throw Error('INVALID_WORKSPACE_REPORT');
  const market = {profit:'b3',binance:'crypto',mt5:'forex'}[input.provider], seen = new Set();
  const operations = input.operations.map(row=>{
    const o = validateOperation(row, {market, now:Date.parse(input.generatedAt)});
    if (seen.has(o.id) || Date.parse(o.updatedAt) > Date.parse(input.generatedAt)) throw Error('DUPLICATE_OR_FUTURE_OPERATION');
    seen.add(o.id); return {...o, brokerRefs:[...o.brokerRefs]};
  });
  return {...input,operations};
}
function summarize(rows) {
  const currencies = new Map();
  for (const o of rows) {
    const netText = operationNet(o); if(netText === null) continue;
    const net = decimal8(netText), c = currencies.get(o.currency) ?? {currency:o.currency,operations:0,gains:0n,losses:0n,gross:0n,fees:0n,financing:0n,net:0n};
    c.operations++; c.net+=net; c.gross+=decimal8(o.gross); c.fees+=decimal8(o.fees); c.financing+=decimal8(o.financing);
    if(net>0n)c.gains+=net;else c.losses-=net; currencies.set(o.currency,c);
  }
  return [...currencies.values()].map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,typeof v==='bigint'?format8(v):v])));
}
export function workspaceReportView(input, {period='30d',now=new Date(),page=0}={}) {
  const report=parseWorkspaceReport(input,now.getTime());
  if(!Number.isSafeInteger(page)||page<0)throw Error('INVALID_REPORT_PAGE');
  const since=ultraPeriodStart(period,now), until=now.getTime();
  const current=report.operations.filter(o=>Date.parse(o.updatedAt)<=until);
  const rows=current.filter(o=>!since||Date.parse(o.closedAt??o.createdAt)>=Date.parse(since)||['sending','unknown','open','partially_closed'].includes(o.state)).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.id.localeCompare(b.id));
  return {provider:report.provider,environment:report.environment,connectionLabel:report.connectionLabel,generatedAt:report.generatedAt,
    currentConnectionConfirmed:false,robotState:'unconfirmed',walletBalance:null,brokerBalance:null,
    totals:summarize(current.filter(o=>o.closedAt&&(!since||Date.parse(o.closedAt)>=Date.parse(since)))),lifetime:summarize(current),
    openCount:current.filter(o=>['open','partially_closed'].includes(o.state)).length,
    uncertainCount:current.filter(o=>['sending','unknown'].includes(o.state)).length,
    awaitingCosts:rows.filter(o=>o.state==='closed'&&!o.costsComplete).length,
    count:rows.length,operations:rows.slice(page*50,(page+1)*50).map(o=>({...o,net:operationNet(o)})),
    platformCosts:{subscription:null,openingFee:null,performance:null,finalNet:null,billable:false}};
}
export const ULTRA_ACCESS_PREPARATION=Object.freeze({
  monthlyCents:1990,annualCents:19900,annualMonthlyMultiples:10,annualMonths:12,payments:1,
  annualStartsAt:'first_immutable_letter_confirmation',
  flowProfessionalBeneficiary:'holder_only',professionalClientsIncluded:false,
  openingFeeCents:500,openingFeeTrigger:'start',openingFeeBillable:false,
  performancePolicyStatus:'pending_confirmation',performanceBillable:false,checkoutEnabled:false,
});
export function ultraAccessPreparation({platform,plan,beneficiary}) {
  if(!['flow','jenios'].includes(platform)||!['individual','personal_defi','plan','professional'].includes(plan)||!['holder','client'].includes(beneficiary))throw Error('INVALID_ACCESS_PREPARATION');
  // A professional client's own separately accepted plan cannot be inferred from
  // the assessor's subscription. This view never creates an entitlement.
  const included = beneficiary==='holder' && (platform==='jenios'?plan!=='individual':['plan','professional'].includes(plan));
  return Object.freeze({...ULTRA_ACCESS_PREPARATION,included,beneficiary,requiresSeparateSubscription:!included,accessGranted:false});
}
/** Proposed start-event contract for the existing central wallet, never a debit. */
export function prepareOpeningFee({platform,ownerScope,operationId,availableWalletCents}) {
  if(!['flow','jenios'].includes(platform)||![ownerScope,operationId].every(v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v))||!(availableWalletCents===null||Number.isSafeInteger(availableWalletCents)&&availableWalletCents>=0))throw Error('INVALID_OPENING_FEE_INTENT');
  return Object.freeze({kind:'opening_fee_preparation',currency:'BRL',amountCents:500,trigger:'start',
    sourcePlatform:platform,
    // ownerScope must be the SAME verified central account/operation namespace
    // across products; the caller must not derive it from e-mail or browser data.
    idempotencyScope:JSON.stringify([ownerScope,operationId,'ultra_start_v1']),
    wallet:'platform_wallet',brokerAccountDebited:false,availableWalletCents,
    fundsStatus:availableWalletCents===null?'unknown':availableWalletCents<500?'insufficient':'sufficient_for_proposal',
    partialExecutionPolicy:null,rejectionPolicy:null,cancellationPolicy:null,insufficientFundsPolicy:null,reversalPolicy:null,
    billable:false,debitExecuted:false,activationBlocked:'TERMS_AND_EDGE_CASES_PENDING'});
}
