export function safeAppTarget(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return null;
 try{const u=new URL(value,'https://jenios.invalid');return u.origin==='https://jenios.invalid'?u.pathname+u.search+u.hash:null;}catch{return null;}
}
export async function readNotifications(db,owner){
 if(!owner)throw new Error('AUTH');
 const {data,error}=await db.from('jenios_social_notifications').select('id,user_id,kind,title,body,target_url,read_at,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error('READ');return (data||[]).filter(x=>x.user_id===owner);
}
export async function markNotificationRead(db,owner,id,now=new Date().toISOString(),dataClient=db){
 if(!owner||!id)throw new Error('AUTH');
 const session=await db.auth.getUser();if(session.error||session.data?.user?.id!==owner)throw new Error('AUTH');
 const {data,error}=await dataClient.from('jenios_social_notifications').update({read_at:now}).eq('id',id).eq('user_id',owner).select('id,user_id,read_at').single();
 if(error||data?.id!==id||data?.user_id!==owner||!data?.read_at)throw new Error('WRITE');return data;
}
