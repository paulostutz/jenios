/** S05: confirmation is verified with Supabase Auth, never with untrusted URL claims. */
const TYPES=new Set(['email','signup']);
const CODES=/^[a-zA-Z0-9_-]{20,1024}$/;

export function parseConfirmationUrl(raw){
  let url;
  try {url=new URL(raw);}catch{return {kind:'invalid'};}
  if(url.searchParams.has('error')||url.searchParams.has('error_code'))return {kind:'invalid'};
  const query=url.searchParams,hash=new URLSearchParams(url.hash.replace(/^#/,''));
  if(hash.has('error')||hash.has('error_code'))return {kind:'invalid'};
  const code=query.get('code');const tokenHash=query.get('token_hash');
  if(code&&tokenHash)return {kind:'invalid'};
  if(code)return CODES.test(code)?{kind:'code',code}:{kind:'invalid'};
  if(tokenHash){const type=query.get('type');return CODES.test(tokenHash)&&TYPES.has(type)?{kind:'otp',tokenHash,type}:{kind:'invalid'};}
  if(hash.has('access_token')||hash.has('refresh_token'))return {kind:'implicit'};
  return {kind:'session'};
}

/** No secret, session object, raw URL or email is returned by this function. */
export async function verifySocialConfirmation(client,url){
  if(!client?.auth?.getUser||!client?.from)return {status:'unavailable'};
  const parsed=parseConfirmationUrl(url);
  if(parsed.kind==='invalid')return {status:'invalid'};
  try {
    if(parsed.kind==='code'){
      if(!client.auth.exchangeCodeForSession)return {status:'unavailable'};
      const exchanged=await client.auth.exchangeCodeForSession(parsed.code);
      if(exchanged.error)return {status:'invalid'};
    } else if(parsed.kind==='otp'){
      if(!client.auth.verifyOtp)return {status:'unavailable'};
      const confirmed=await client.auth.verifyOtp({token_hash:parsed.tokenHash,type:parsed.type});
      if(confirmed.error)return {status:'invalid'};
    }
    // Legacy hash flow is resolved by Supabase-js detectSessionInUrl, not by browser data.
    const userResult=await client.auth.getUser();const user=userResult?.data?.user;
    if(userResult?.error||!user?.id||user.is_anonymous)return {status:'invalid'};
    const profile=await client.from('profiles').select('id').eq('id',user.id).maybeSingle();
    if(profile?.error)return {status:'unavailable'};
    if(profile?.data?.id!==user.id)return {status:'profile-missing'};
    return {status:'ready',userId:user.id};
  }catch{return {status:'unavailable'};}
}
