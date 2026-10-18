/**
 * S05: read-only HTTP smoke for an ISOLATED Vercel Preview only.
 * Usage: S05_PREVIEW_URL=https://jenios-ecossistem-...-jenios.vercel.app node scripts/check-s05-public-preview.mjs
 * Never executes against a custom production domain. No login, account provisioning, paid operations or client data.
 */
const requested=process.env.S05_PREVIEW_URL;
const url=(()=>{try{return new URL(requested)}catch{throw Error('S05_PREVIEW_URL_REQUIRED')}})();
if(url.protocol!=='https:'||!/^jenios-ecossistem-[a-z0-9-]+-jenios\.vercel\.app$/.test(url.hostname)||url.pathname!=='/'||url.search||url.hash)
 throw Error('S05_PREVIEW_MUST_BE_ISOLATED_VERCEL_HOST');
const timeout=15000;
let pass=0;
async function request(path,{method='GET',body}={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const r=await fetch(new URL(path,url),{method,headers:{accept:'application/json',...body?{'content-type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{},cache:'no-store',redirect:'manual',signal:ctrl.signal});
  let response=null;
  try{response=await r.json()}catch{}
  return {status:r.status,redirect:r.headers.get('location'),json:response};
 }finally{clearTimeout(timer)}
}
function check(label,result){if(!result)throw Error('S05_PREVIEW_SMOKE_FAIL: '+label);pass++;console.log('PASS '+label)}
const pages=['/social','/cadastro','/login','/auth/confirm','/social/configuracoes','/bankscore/detalhado','/social/consulta-detalhada'];
for(const path of pages){
 const r=await request(path);
 check('public page '+path+' returns 200 without staging redirect',r.status===200&&!r.redirect);
}
const proposed=await request('/api/social/handles?handle=s05_b36_readonly_probe');
check('handle availability responds with real RPC result',proposed.status===200
 && proposed.json?.handle==='s05_b36_readonly_probe'
 && typeof proposed.json.available==='boolean'
 && Array.isArray(proposed.json.suggestions)
 && proposed.json.suggestions.length<=4);
const reserved=await request('/api/social/handles?handle=admin');
check('reserved @ fails closed',reserved.status===400);
const noFeed=await request('/api/social/posts');
check('unauthenticated feed API is denied',noFeed.status===401);
const noDelete=await request('/api/social/account-deletion');
check('unauthenticated deletion request is denied',noDelete.status===401);
const noMedia=await request('/api/social/media',{method:'POST',body:{contentType:'image/jpeg',size:4}});
check('unauthenticated signed-media upload is denied',noMedia.status===401);
const video=await request('/api/social/video-capabilities');
check('video optimization is disabled and original playback fallback remains enabled',
 video.status===200 && video.json?.optimization==='disabled' && video.json?.playbackFallback===true);
const bankscore=await request('/api/bankscore/detailed',{method:'POST',body:{format:'pdf',target:{}}});
check('BankScore full PDF cannot be issued without Social session',bankscore.status===401);
const crypto=await request('/api/crypto-validator/detailed',{method:'POST',body:{format:'pdf',target:{}}});
check('Token validator full PDF cannot be issued without Social session',crypto.status===401);
const trial=await request('/api/platform/trial');
check('unapproved Platform trial cannot be started from integrated release',
 trial.status===404 || (trial.status===503 && trial.json?.code==='TRIAL_NOT_AVAILABLE'));
// Free during prelaunch: no payment order may be created for either report.
for(const [productCode,target,expectedPath] of [
 ['social-bankscore-report',{codigo:'123',periodo:'202606'},'/bankscore/detalhado'],
 ['social-crypto-validator',{network:'ethereum',type:'token',identifier:'0x'+'1'.repeat(40)},'/social/consulta-detalhada']
]){
 const quote=await request('/api/jenios-pay/checkout',{method:'POST',body:{productCode,target}});
 check('free prelaunch checkout blocked for '+productCode,
  quote.status===409 && typeof quote.json?.reportUrl==='string'
  && new URL(quote.json.reportUrl,url).pathname===expectedPath
  && quote.json.error?.includes('gratuito'));
}
console.log('RESULT '+JSON.stringify({checks:pass,failed:0,mode:'anonymous read-only and denied writes',target:'isolated preview only'}));
