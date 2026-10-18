/**
 * JENIOS S05 — production-safe, authenticated E2E helper for ISOLATED staging.
 * Requires TWO independently provisioned non-production email/password test identities.
 * Never creates identities or uses service_role. Uses only ordinary user JWTs.
 * Every test post is marked, owner-bound and removed in finally.
 * This module is also testable with an entirely in-memory HTTP fixture.
 */
const STAGE_URL = 'https://rebzztxlzofxpfwjvbee.supabase.co';
const PREVIEW_HOST = /^jenios-ecossistem-[a-z0-9-]+-jenios\.vercel\.app$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const statusError = (label,status)=>Object.assign(new Error('S05_E2E_'+label+'_HTTP_'+status),{code:'S05_E2E_'+label,status});
export function validateStagingE2EConfig(input={}){
 let url;
 try{url=new URL(input.previewUrl)}catch{throw Error('S05_E2E_PREVIEW_URL_REQUIRED')}
 if(url.protocol!=='https:' || !PREVIEW_HOST.test(url.hostname) || url.pathname!=='/' || url.search || url.hash)
  throw Error('S05_E2E_REFUSE_NON_PREVIEW_HOST');
 if(input.stageUrl && input.stageUrl!==STAGE_URL)throw Error('S05_E2E_REFUSE_NON_ISOLATED_SUPABASE');
 if(typeof input.publishableKey!=='string'||input.publishableKey.length<20)
  throw Error('S05_E2E_STAGING_PUBLISHABLE_KEY_REQUIRED');
 for(const suffix of ['A','B']){
  if(typeof input['email'+suffix]!=='string'||!EMAIL.test(input['email'+suffix])||
     typeof input['password'+suffix]!=='string'||input['password'+suffix].length<8)
    throw Error('S05_E2E_TWO_TEST_IDENTITIES_REQUIRED');
 }
 if(input.emailA.toLowerCase()===input.emailB.toLowerCase())
  throw Error('S05_E2E_IDENTITIES_MUST_BE_DISTINCT');
 return {previewOrigin:url.origin,stageOrigin:STAGE_URL};
}
async function parseResponse(response,label,allowed){
 let payload;
 try{payload=await response.json()}catch{throw Error('S05_E2E_BAD_JSON_'+label)}
 if(!allowed.includes(response.status))throw statusError(label,response.status);
 return payload;
}
export async function certifyStagingFeed({
 previewUrl,stageUrl=STAGE_URL,publishableKey,emailA,passwordA,emailB,passwordB,
 fetcher=globalThis.fetch,now=()=>new Date().toISOString(),timeoutMs=15000
}={}){
 const {previewOrigin,stageOrigin}=validateStagingE2EConfig({
  previewUrl,stageUrl,publishableKey,emailA,passwordA,emailB,passwordB
 });
 if(typeof fetcher!=='function')throw Error('S05_E2E_FETCH_REQUIRED');
 const request=async(origin,path,{method='GET',token,body,key=false}={})=>{
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),timeoutMs);
  try{
   return await fetcher(new URL(path,origin).href,{
    method,cache:'no-store',redirect:'error',signal:ac.signal,
    headers:{'accept':'application/json',...(key?{'apikey':publishableKey}:{}),
      ...(token?{'authorization':'Bearer '+token}:{}),
      ...(body!==undefined?{'content-type':'application/json'}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
   });
  }finally{clearTimeout(timer)}
 };
 const login=async(email,password)=>{
  const result=await parseResponse(await request(stageOrigin,'/auth/v1/token?grant_type=password',{
   method:'POST',key:true,body:{email,password}
  }),'AUTH',[200]);
  if(!UUID.test(result?.user?.id||'')||result?.user?.is_anonymous||
     typeof result.access_token!=='string'||result.access_token.length<20)
   throw Error('S05_E2E_INVALID_STAGING_IDENTITY');
  return {id:result.user.id,token:result.access_token};
 };
 const api=(path,options={})=>request(previewOrigin,'/api/social/'+path,options);
 let owner,visitor,postId,cleanup='no-post-created';
 const marker='JENIOS-S05-E2E-NONPROD-'+now();
 const steps=[];
 const pass=label=>steps.push(label);
 try{
  owner=await login(emailA,passwordA);
  visitor=await login(emailB,passwordB);
  if(owner.id===visitor.id)throw Error('S05_E2E_DUPLICATE_USER_ID');
  pass('two independent staging Auth logins');
  const created=await parseResponse(await api('posts',{method:'POST',token:owner.token,body:{body:marker,media:[]}}),'CREATE_POST',[201]);
  postId=created?.post?.id;
  if(!UUID.test(postId||'')||created.post?.author_id!==owner.id||created.post?.body!==marker)
   throw Error('S05_E2E_POST_NOT_SAVED_TO_OWNER');
  pass('server persisted owner-bound post');
  const freshOwner=await login(emailA,passwordA);
  if(freshOwner.id!==owner.id)throw Error('S05_E2E_OWNER_CHANGED_AFTER_NEW_LOGIN');
  const feed=await parseResponse(await api('posts?limit=50',{token:freshOwner.token}),'FRESH_FEED',[200]);
  if(!feed?.posts?.some(p=>p.id===postId&&p.body===marker))throw Error('S05_E2E_NOT_PERSISTED_AFTER_SECOND_LOGIN');
  pass('post remains after a fresh authenticated session');
  const profile=await parseResponse(await api('profiles?id='+encodeURIComponent(owner.id),{token:freshOwner.token}),'PROFILE',[200]);
  if(profile?.profile?.id!==owner.id||!profile?.posts?.some(p=>p.id===postId))
   throw Error('S05_E2E_PROFILE_GRID_NOT_PERSISTED');
  pass('profile grid reads same persisted database post');
  const visitorFeed=await parseResponse(await api('posts?limit=50',{token:visitor.token}),'VISITOR_FEED',[200]);
  if(!visitorFeed?.posts?.some(p=>p.id===postId))throw Error('S05_E2E_NOT_VISIBLE_TO_SECOND_ACCOUNT');
  pass('second account sees non-archived post');
  await parseResponse(await api('posts?id='+encodeURIComponent(postId),{method:'DELETE',token:visitor.token}),'FOREIGN_DELETE',[404]);
  pass('second account cannot delete first account post');
  const comment=await parseResponse(await api('comments',{
   method:'POST',token:visitor.token,body:{postId,body:'Teste de comentário S05',parentId:null}
  }),'VISITOR_COMMENT',[201]);
  if(!UUID.test(comment?.comment?.id||''))throw Error('S05_E2E_COMMENT_NOT_SAVED');
  pass('second account can comment on permitted post');
  const liked=await parseResponse(await api('likes',{
   method:'POST',token:visitor.token,body:{postId}
  }),'VISITOR_LIKE',[200]);
  if(liked?.liked!==true)throw Error('S05_E2E_LIKE_NOT_SAVED');
  pass('second account can like permitted post');
  await parseResponse(await api('archive',{
   method:'PATCH',token:freshOwner.token,body:{postId,archived:true}
  }),'ARCHIVE',[200]);
  const archived=await parseResponse(await api('posts?limit=50',{token:visitor.token}),'ARCHIVED_VISITOR_FEED',[200]);
  if(archived?.posts?.some(p=>p.id===postId))throw Error('S05_E2E_ARCHIVED_POST_VISIBLE');
  pass('archived post hidden from other account');
  await parseResponse(await api('archive',{
   method:'PATCH',token:freshOwner.token,body:{postId,archived:false}
  }),'UNARCHIVE',[200]);
  pass('post owner can unarchive post');
  const removed=await parseResponse(await api('posts?id='+encodeURIComponent(postId),{
   method:'DELETE',token:freshOwner.token
  }),'OWNER_DELETE',[200]);
  if(removed.deleted!==true)throw Error('S05_E2E_OWNER_DELETE_NOT_ACKNOWLEDGED');
  cleanup='deleted-by-owner';postId=null;
  pass('owner deletes only synthetic test post');
  return {passed:steps.length,checks:steps,cleaned:true,staging:true};
 }finally{
  // Best effort cleanup only for the exact test post and its original creator.
  if(postId&&UUID.test(postId)&&owner?.token){
   try{
    const response=await api('posts?id='+encodeURIComponent(postId),{
     method:'DELETE',token:owner.token
    });
    cleanup=[200,404].includes(response.status)?'deleted-in-finally':'manual-cleanup-required';
   }catch{cleanup='manual-cleanup-required'}
  }
  if(cleanup==='manual-cleanup-required')
   console.error('S05_E2E_CLEANUP_REQUIRED_FOR_SYNTHETIC_POST_ONLY');
 }
}
