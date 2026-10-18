/**
 * Read-only JENIOS production smoke. Only runs on the exact canonical production domain.
 * Never creates accounts, posts, payments, identities, or data records.
 * Run after an explicitly authorized successful production deployment:
 *     node scripts/check-s05-production-acceptance.mjs
 */
const origin='https://jenios.com.br';
async function check(path,{method='GET',body}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(origin+path,{method,redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{'accept':'application/json',...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  let payload;try{payload=await response.json()}catch{payload=null}
  return {status:response.status,payload};
 }finally{clearTimeout(timer)}
}
let passed=0;
function passedGate(label,bool){if(!bool)throw Error('S05_PRODUCTION_SMOKE_BLOCKED_'+label);passed++;console.log('PASS '+label)}
const main=await check('/social');
passedGate('SOCIAL_PRESENT',main.status===200);
const bank=await check('/api/bankscore/ranking');
passedGate('BANKSCORE_DATA_AVAILABLE',bank.status===200&&Array.isArray(bank.payload?.ranking)&&bank.payload.ranking.length>0);
const handles=await check('/api/social/handles?handle=s05_prod_acceptance_probe');
passedGate('HANDLE_RPC_AVAILABLE',handles.status===200&&typeof handles.payload?.available==='boolean');
const guestFeed=await check('/api/social/posts');
passedGate('FEED_GUEST_DENIED',guestFeed.status===401);
const guestDeletion=await check('/api/social/account-deletion');
passedGate('ACCOUNT_DELETION_GUEST_DENIED',guestDeletion.status===401);
const guestBankPdf=await check('/api/bankscore/detailed',{method:'POST',body:{format:'pdf',target:{}}});
passedGate('BANKSCORE_PDF_GUEST_DENIED',guestBankPdf.status===401);
const guestCryptoPdf=await check('/api/crypto-validator/detailed',{method:'POST',body:{format:'pdf',target:{}}});
passedGate('CRYPTO_PDF_GUEST_DENIED',guestCryptoPdf.status===401);
const video=await check('/api/social/video-capabilities');
passedGate('ORIGINAL_VIDEO_FALLBACK',video.status===200&&video.payload?.playbackFallback===true);
console.log('RESULT '+JSON.stringify({passes:passed,errors:0,mode:'safe-read-only-production-smoke'}));
