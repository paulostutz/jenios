/** B298 — offline private evidence audit. NO URLs, credentials, GET, POST or orders. */
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {
 inspectB298SignedReadEnvelope,auditB298SignedOrderPair,
 auditB298SignedPositionPair,auditB298SignedSignalDelivery,
 auditB298SignedOperatorIntent,assessB298ExternalIntegrationGate
} from '../../../lib/platform/research/b298-signed-evidence-audit.mjs';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const names=['signedOrders','signedPositions','signedSignalReceipts','signedOperatorIntents'];
const env=process.env;
if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_B298_PRIVATE_READ_ONLY!=='true'||
 ['JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
  'JENIOS_REAL_EXECUTION_ENABLED'].some(key=>env[key]==='true'))
 fail('B298_PRIVATE_READ_ONLY_MODE_REQUIRED');
const scope={ownerDigest:env.JENIOS_B298_OWNER_DIGEST,
 accountDigest:env.JENIOS_B298_ACCOUNT_DIGEST,
 consentDigest:env.JENIOS_B298_CONSENT_DIGEST};
if(!Object.values(scope).every(hex))fail('B298_TRUSTED_SCOPE_REQUIRED');
const sourcePath=env.JENIOS_B298_EVIDENCE_PATH,
 publicKeyPath=env.JENIOS_B298_TRUSTED_PUBLIC_KEY_PATH;
async function privateFile(path,maxSize){
 if(typeof path!=='string'||!path.startsWith('/')||path.length>2048||!path.endsWith('.json')&&maxSize>5000)
  fail('B298_PRIVATE_INPUT_PATH_REQUIRED');
 if(!path.startsWith('/')||!path||path.includes('\0'))fail('B298_PRIVATE_INPUT_PATH_REQUIRED');
 const p=resolve(path),repo=resolve(process.cwd()),parent=dirname(p);
 if(p===repo||p.startsWith(repo+sep))fail('B298_PRIVATE_INPUT_INSIDE_REPOSITORY');
 const [file,dir,real]=await Promise.all([lstat(p),lstat(parent),realpath(p)]);
 if(real!==p||!file.isFile()||file.nlink!==1||file.size>maxSize||file.size<1||
  (file.mode&0o077)!==0||!dir.isDirectory()||(dir.mode&0o077)!==0||
  (typeof process.getuid==='function'&&file.uid!==process.getuid()))
 fail('B298_PRIVATE_FILE_NOT_PROTECTED');
 return readFile(p,'utf8');
}
const raw=await privateFile(sourcePath,524288);
const pem=await privateFile(publicKeyPath,4096);
if(!pem.includes('BEGIN PUBLIC KEY'))fail('B298_COLLECTOR_PUBLIC_KEY_REQUIRED');
const keyId=env.JENIOS_B298_TRUSTED_KEY_ID;
if(typeof keyId!=='string'||!/^[A-Za-z0-9._:-]{1,80}$/.test(keyId))
 fail('B298_TRUSTED_KEY_ID_REQUIRED');
let data;try{data=JSON.parse(raw);}catch{fail('B298_INVALID_OFFLINE_PACKAGE');}
const keys=['schema','signedOrders','signedPositions','signedSignalReceipts',
 'signedOperatorIntents','b297Capture'];
if(!data||typeof data!=='object'||Array.isArray(data)||
 Object.keys(data).some(k=>!keys.includes(k))||
 data.schema!=='JENIOS_B298_OFFLINE_PRIVATE_PACKAGE_V1'||
 names.some(n=>data[n]!==undefined&&(!Array.isArray(data[n])||data[n].length>30))||
 !names.some(n=>data[n]?.length>0))fail('B298_INVALID_OFFLINE_PACKAGE');
const settings={scope,trustedKeys:{[keyId]:pem},nowMs:Date.now()};
const auditOne=e=>inspectB298SignedReadEnvelope(e,settings);
// Key and scope come exclusively from trusted local configuration, never package fields.
const orderPairs=(data.signedOrders||[]).map(pair=>{
 if(!Array.isArray(pair)||pair.length!==2)fail('B298_INVALID_ORDER_PAIR');
 return auditB298SignedOrderPair({first:pair[0],second:pair[1],...settings});
});
const positionPairs=(data.signedPositions||[]).map(pair=>{
 if(!Array.isArray(pair)||pair.length!==2)fail('B298_INVALID_POSITION_PAIR');
 return auditB298SignedPositionPair({first:pair[0],second:pair[1],...settings});
});
const signals=(data.signedSignalReceipts||[]).map(receipt=>{
 if(!data.b297Capture)fail('B298_B297_CAPTURE_REQUIRED');
 return auditB298SignedSignalDelivery({capture:data.b297Capture,receipt,...settings});
});
const intents=(data.signedOperatorIntents||[]).map(envelope=>
 auditB298SignedOperatorIntent({envelope,...settings}));
// Explicitly avoid echoing the raw exports, source IDs, account IDs or public key.
const report={schema:'JENIOS_B298_OFFLINE_PRIVATE_AUDIT_V1',
 packageSha256:createHash('sha256').update(raw).digest('hex'),
 signedOrderPairs:orderPairs.length,signedPositionPairs:positionPairs.length,
 signedReceipts:signals.length,signedIntents:intents.length,
 orderAssessments:orderPairs.map(x=>({assessment:x.assessment,
  lastObservedKind:x.lastObservedKind,manualBrokerReviewRequired:true,
  partialCancelRequiresExposureReview:x.partialCancelRequiresExposureReview})),
 positionAssessments:positionPairs.map(x=>({assessment:x.assessment,
  observedPositionCloseCertified:false})),
 signalDeliveryClaims:signals.map(x=>({receiptStatus:x.receiptStatus,
  recipientActuallyReceivedCertified:false})),
 operatorModes:intents.map(x=>({mode:x.commercialMode,
  referenceDecision:x.referenceDecision,executionEnabled:false})),
 external:assessB298ExternalIntegrationGate(),
 ordersSent:0,paperOrdersSent:0,paymentsCreated:0,deploymentsCreated:0};
process.stdout.write(JSON.stringify(report,null,2)+'\n');