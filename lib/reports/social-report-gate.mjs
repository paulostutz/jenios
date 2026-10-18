/** Client display state only; backend authorization remains mandatory. */
export async function resolveSocialReportGate(client){
  if(!client?.auth?.getUser||!client?.from)return {status:'unavailable',userId:''};
  try{
    const result=await client.auth.getUser();
    const user=result?.data?.user;
    if(result?.error||!user?.id||user.is_anonymous)return {status:'guest',userId:''};
    const profile=await client.from('profiles').select('id').eq('id',user.id).maybeSingle();
    if(profile?.error)return {status:'unavailable',userId:''};
    if(profile?.data?.id!==user.id)return {status:'profile-missing',userId:''};
    return {status:'ready',userId:user.id};
  }catch{return {status:'unavailable',userId:''};}
}
