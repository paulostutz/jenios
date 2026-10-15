// Explicit setup command only. Never executed by build, install or deploy.
import { createClient } from '@supabase/supabase-js';
import { MEDIA_TYPES } from '../lib/social/media.mjs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure as credenciais server-side antes do setup.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=process.env.SOCIAL_MEDIA_BUCKET||'social-media';
const {data:buckets,error}=await db.storage.listBuckets();if(error)throw new Error('Não foi possível listar os buckets.');
const existing=buckets.find(item=>item.id===bucket);
if(existing){
  if(!existing.public)throw new Error('Bucket existente é privado. Nenhuma configuração foi alterada.');
  console.log('Bucket público já existente; preservado.');
}else{
  const {error:creationError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:50*1024*1024,allowedMimeTypes:Object.keys(MEDIA_TYPES)});
  if(creationError)throw new Error('Não foi possível criar o bucket da Social.');
  console.log('Bucket público da Social criado. Não envie conteúdo privado.');
}
