/**
 * Server-to-server identity verification bridge (no browser-supplied CPF accepted).
 * No provider is configured by default; never treat a client assertion as proof.
 */
const unavailable=()=>Object.assign(new Error('Verificação independente de identidade indisponível.'),{status:503,code:'IDENTITY_PROVIDER_UNAVAILABLE'});
export async function verifyIdentityWithProvider({userId,verificationToken},
 {endpoint,apiKey,fetcher=globalThis.fetch,timeoutMs=6000}={}) {
 if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId))throw unavailable();
 if(typeof verificationToken!=='string'||verificationToken.length<20||verificationToken.length>4096)throw unavailable();
 if(typeof apiKey!=='string'||apiKey.length<24||typeof fetcher!=='function')throw unavailable();
 let url;
 try {url=new URL(endpoint);} catch {throw unavailable();}
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.search||url.hash||
   ['localhost','127.0.0.1','::1'].includes(url.hostname.toLowerCase()))throw unavailable();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.min(Math.max(timeoutMs,500),10000));
 try {
  const response=await fetcher(url.href,{method:'POST',redirect:'error',cache:'no-store',signal:controller.signal,
   headers:{'content-type':'application/json','accept':'application/json','authorization':'Bearer '+apiKey},
   body:JSON.stringify({subject_user_id:userId,verification_token:verificationToken})});
  if(response.status!==200||Number(response.headers?.get?.('content-length')||0)>8192)throw unavailable();
  const text=await response.text(); if(text.length>8192)throw unavailable();
  let result;try{result=JSON.parse(text);}catch{throw unavailable();}
  if(!result||Array.isArray(result)||result.userId!==userId||result.verified!==true||
     result.documentType!=='CPF'||typeof result.document!=='string'||
     typeof result.verifiedAt!=='string'||typeof result.expiresAt!=='string')throw unavailable();
  return {userId,verified:true,documentType:'CPF',document:result.document,
   verifiedAt:result.verifiedAt,expiresAt:result.expiresAt};
 } catch {throw unavailable();} finally {clearTimeout(timer);}
}