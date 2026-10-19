/**
 * Client de diagnóstico da Platform. A API é a única fonte de confirmação.
 * Falhas nunca liberam negociação real. Preferências por conta ficam em sessionStorage.
 */
export function sessionModeKey(userId) {
  return 'jenios_modo_operacional:'+String(userId||'guest');
}
export function readSessionMode(storage,userId) {
  if (!storage?.getItem) return null;
  try {
    const mode=storage.getItem(sessionModeKey(userId));
    return mode==='manual'||mode==='reversa'?mode:null;
  } catch {return null;}
}
export function writeSessionMode(storage,userId,mode) {
  if (!storage?.setItem || !['manual','reversa'].includes(mode)) return false;
  try {storage.setItem(sessionModeKey(userId),mode);return true;}catch{return false;}
}

export async function currentPlatformSession(supabase) {
  if (!supabase?.auth) return null;
  try {
    const {data,error}=await supabase.auth.getSession();
    const session=data?.session;
    if (error||!session?.access_token||!session.user?.id||session.user.is_anonymous) return null;
    return session;
  } catch {return null;}
}

export async function loadAccountDiagnostic(supabase,fetcher=fetch) {
  const session=await currentPlatformSession(supabase);
  if (!session) return {verified:false,completed:false,userId:null,reason:'auth_required'};
  try {
    const response=await fetcher('/api/platform/diagnostico',{
      headers:{authorization:'Bearer '+session.access_token},cache:'no-store'
    });
    if (!response.ok) return {verified:false,completed:false,userId:session.user.id,reason:'backend_unavailable'};
    const data=await response.json();
    if (data?.verified===true && data.completed===true && ['manual','reversa'].includes(data.mode)) {
      return {verified:true,completed:true,userId:session.user.id,
        mode:data.mode,createdAt:data.createdAt,timeframe:data.timeframe,reason:null};
    }
    return {verified:false,completed:false,userId:session.user.id,reason:'not_completed'};
  } catch {
    return {verified:false,completed:false,userId:session.user.id,reason:'backend_unavailable'};
  }
}

export async function submitAccountDiagnostic(supabase,answers,timeframe,fetcher=fetch) {
  const session=await currentPlatformSession(supabase);
  if (!session) return {verified:false,reason:'auth_required',userId:null};
  try {
    const response=await fetcher('/api/platform/diagnostico',{
      method:'POST',cache:'no-store',
      headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},
      body:JSON.stringify({answers,timeframe})
    });
    if(!response.ok) return {verified:false,reason:'backend_unavailable',userId:session.user.id};
    const data=await response.json();
    if(data?.verified!==true||!['manual','reversa'].includes(data.mode))
      return {verified:false,reason:'backend_unavailable',userId:session.user.id};
    return {verified:true,mode:data.mode,userId:session.user.id,reason:null};
  } catch {return {verified:false,reason:'backend_unavailable',userId:session.user.id};}
}
