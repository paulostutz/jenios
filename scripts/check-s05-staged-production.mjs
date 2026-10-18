/**
 * JENIOS S05 — staged PRODUCTION build acceptance before domain promotion.
 * Supply S05_STAGED_URL=https://jenios-ecossistem-<id>-jenios.vercel.app
 * Read-only probes except checkout POST for the TWO explicitly free reports;
 * checkout must return 409 BEFORE a DB or payment call.
 * No passwords, identities, uploads or actual payments.
 */
const value=process.env.S05_STAGED_URL;
let url;try{url=new URL(value)}catch{throw Error('S05_STAGED_URL_REQUIRED')}
if(url.protocol!=='https:'||!/^(jenios-ecossistem-[a-z0-9-]+-jenios|jenios-ecossistem)\.vercel\.app$/.test(url.hostname)||
 url.pathname!=='/'||url.search||url.hash)
 throw Error('S05_STAGED_URL_MUST_BE_JENIOS_DEPLOYMENT');
let total=0;
async function probe(path,{method='GET',body}={}){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);
 try{
  const r=await fetch(new URL(path,url),{method,signal:ac.signal,redirect:'error',cache:'no-store',headers:{
   accept:'application/json',...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let json=null;try{json=await r.json()}catch{}
  return {status:r.status,json};
 }finally{clearTimeout(timer)}
}
function requireGate(name,condition){
 if(!condition)throw Error('S05_STAGED_PRODUCTION_GATE_FAILED_'+name);
 total++;console.log('PASS '+name);
}
for(const path of ['/','/social','/cadastro','/login']){
 const r=await probe(path);requireGate('PAGE_'+path,r.status===200);
}
const b=await probe('/api/bankscore/ranking');
requireGate('BANKSCORE_PRODUCTION_DATA',b.status===200&&Array.isArray(b.json?.ranking)&&b.json.ranking.length>0);
const pay=await probe('/api/jenios-pay/health');
requireGate('PAY_PRODUCTION_DB',pay.status===200&&pay.json?.database==='connected'&&pay.json?.paymentsEnabled===false);
const handle=await probe('/api/social/handles?handle=s05_prod_stage_probe');
requireGate('HANDLE_RPC',handle.status===200&&handle.json?.available===true);
for(const [label,path] of [['POSTS','/api/social/posts'],['DELETION','/api/social/account-deletion']]){
 const r=await probe(path);requireGate('GUEST_DENIED_'+label,r.status===401);
}
for(const [name,path] of [['BANKSCORE','/api/bankscore/detailed'],['CRYPTO','/api/crypto-validator/detailed']]){
 const r=await probe(path,{method:'POST',body:{format:'pdf',target:{}}});
 requireGate('PDF_GUEST_DENIED_'+name,r.status===401);
}
for(const [name,productCode,target,route] of [
 ['BANKSCORE','social-bankscore-report',{codigo:'123',periodo:'202606'},'/bankscore/detalhado'],
 ['CRYPTO','social-crypto-validator',{network:'ethereum',type:'token',identifier:'0x'+'1'.repeat(40)},'/social/consulta-detalhada']
]){
 const r=await probe('/api/jenios-pay/checkout',{method:'POST',body:{productCode,target}});
 requireGate('CHECKOUT_BLOCKED_FREE_'+name,r.status===409
  &&new URL(r.json?.reportUrl||'/',url).pathname===route
  &&r.json?.error?.includes('gratuito'));
}
const video=await probe('/api/social/video-capabilities');
requireGate('VIDEO_ORIGINAL_FALLBACK',video.status===200&&video.json?.playbackFallback===true);
const trial=await probe('/api/platform/trial');
requireGate('PLATFORM_TRIAL_DISABLED',trial.status===503&&trial.json?.code==='TRIAL_NOT_AVAILABLE');
console.log('RESULT '+JSON.stringify({passed:total,failed:0,mode:'staged-production-no-domain-promotion'}));
