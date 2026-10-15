import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { requirePayToken, requirePayUser } from '../../../../lib/pay/auth.mjs';
import { MEDIA_TYPES, validateMediaMetadata } from '../../../../lib/social/media.mjs';

export const dynamic='force-dynamic';
export async function POST(request){
  try{
    requirePayToken(request);
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)throw Object.assign(new Error('Storage não configurado neste ambiente.'),{status:503});
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const user=await requirePayUser(request,db);
    const metadata=validateMediaMetadata(await request.json());
    const bucket=process.env.SOCIAL_MEDIA_BUCKET||'social-media';
    const {data:config,error:bucketError}=await db.storage.getBucket(bucket);
    if(bucketError||!config?.public)throw Object.assign(new Error('O armazenamento público da Social ainda precisa ser configurado.'),{status:503});
    if(!config.file_size_limit||config.file_size_limit>50*1024*1024||!Array.isArray(config.allowed_mime_types)||config.allowed_mime_types.some(type=>!Object.hasOwn(MEDIA_TYPES,type)))throw Object.assign(new Error('Configure os limites e tipos de arquivo permitidos no bucket da Social.'),{status:503});
    const path=user.id+'/'+randomUUID()+'.'+metadata.extension;
    const {data,error}=await db.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});
    if(error)throw error;
    const {data:publicData}=db.storage.from(bucket).getPublicUrl(path);
    return Response.json({bucket,path,token:data.token,publicUrl:publicData.publicUrl},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.status?error.message:'Não foi possível preparar a mídia. Confira formato, tamanho e duração.'},{status:error.status||400,headers:{'Cache-Control':'no-store'}})}
}

export async function PUT(request){
  try{
    requirePayToken(request);
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)throw Object.assign(new Error('Storage não configurado.'),{status:503});
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),user=await requirePayUser(request,db);
    const body=await request.json();const parts=String(body.path||'').split('/');
    if(parts.length!==2||parts[0]!==user.id||!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$/i.test(parts[1]))throw Object.assign(new Error('Arquivo não pertence à sua conta.'),{status:403});
    const bucket=process.env.SOCIAL_MEDIA_BUCKET||'social-media';
    const {data,error}=await db.storage.from(bucket).list(user.id,{limit:10,search:parts[1]});if(error)throw error;
    const file=data?.find(item=>item.name===parts[1]);if(!file)throw new Error('Arquivo não encontrado.');
    validateMediaMetadata({contentType:file.metadata?.mimetype,size:Number(file.metadata?.size),duration:body.duration});
    if(!parts[1].endsWith('.'+MEDIA_TYPES[file.metadata.mimetype]))throw new Error('Formato não corresponde à extensão do upload.');
    const {data:publicData}=db.storage.from(bucket).getPublicUrl(body.path);
    return Response.json({publicUrl:publicData.publicUrl},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.status?error.message:'Arquivo enviado não corresponde aos limites de tamanho e formato.'},{status:error.status||400,headers:{'Cache-Control':'no-store'}})}
}
