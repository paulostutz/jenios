/** B278 public-market research capture; no broker credentials or order routes.
 * GitHub CI archives only SHA manifests, never redistributes full price history.
 * A failed network/quality check produces an explicit FAILED_CLOSED evidence file.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {
 B278_PRODUCTS,planRecentClosedPeriod,collectPublicHistoricalPlan,
 summarizeB278Collection
} from '../../../lib/platform/research/b278-historical-ingest.mjs';

const dir='.jenios-b278-ci';
const capturedAtMs=Date.now();
const capturedAt=new Date(capturedAtMs).toISOString();
const file=dir+'/B278_PUBLIC_MARKET_CAPTURE.json';
const base=Object.freeze({schema:'JENIOS_B278_LIVE_CAPTURE_ATTEMPT_V1',
 capturedAt,source:'coinbase_exchange_public_spot_candles',
 collectionMode:'BOUND_PUBLIC_GET_HISTORY_NO_AUTH',
 purpose:'research_only_not_production',
 rawMarketCandlesArchived:false,
 legalDataRedistributionPermissionVerified:false,
 providerSignedAttestation:false,
 crossProviderVerification:false,
 usdToUsdtConverted:false,
 historicalSplitPreRegisteredInPast:false,
 ordersSent:0,paperOrdersSent:0,liveTradingEnabled:false,
 profitabilityCertified:false});
await mkdir(dir,{recursive:true});
const cleanCode=x=>typeof x==='string'&&/^B278_[A-Z0-9_]{3,90}$/.test(x)?x:'B278_UNCLASSIFIED_COLLECTION_FAILURE';
let result,exitCode=1;
try{
 const results=[];
 for(const product of B278_PRODUCTS){
  const plan=planRecentClosedPeriod(product.id,{now:capturedAtMs});
  const intake=await collectPublicHistoricalPlan(plan,{spacingMs:650});
  results.push(intake);
  console.log('B278_PUBLIC_HISTORY_QUALITY_OK',product.id,intake.manifest.received,intake.manifest.candlesSha256);
 }
 const report=summarizeB278Collection(results);
 result={...base,status:'THREE_ASSETS_LOCAL_QUALITY_PASSED',providerHttpUnverified:true,
  qualityStatus:'COMPLETE_CONTIGUOUS_SPOT_H1',
  products:report.rows.map(row=>({
   product:row.product,source:row.source,quoteCurrency:row.quoteCurrency,
   startMs:row.startMs,endMs:row.endMs,received:row.count,
   candlesSha256:row.candlesSha256,
   qualityPassed:row.qualityPassed,
   retrospectiveSplit:row.split
  })),
  allThreePassed:true,realHistoricalMarketDataRetrieved:true,
  realBacktestPerformed:false,statisticalAdvantageCertified:false,
  prospectiveEvidenceCollected:false};
 exitCode=0;
}catch(error){
 result={...base,status:'FAILED_CLOSED_NO_THREE_ASSET_ATTESTATION',
  code:cleanCode(error?.code||error?.message),
  allThreePassed:false,realHistoricalMarketDataRetrieved:false,
  realBacktestPerformed:false,statisticalAdvantageCertified:false,
  prospectiveEvidenceCollected:false,
  explanation:'No complete three-asset quality-certified data manifest is available. Do not claim real historical OOS validation.'};
 console.error('B278_PUBLIC_HISTORY_NOT_CERTIFIED',result.code);
}
await writeFile(file,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'w'});
console.log('B278_EVIDENCE',file,result.status);
process.exitCode=exitCode;
