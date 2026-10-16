import {socialContext} from '../auth.mjs';
import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {publicPost,POST_FIELDS} from '../../../../lib/social/schema.mjs';
import {optimizeStoredVideo} from '../../../../lib/social/video-processing.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
export async function POST(request){const headers={'Cache-Control':'no-store'};try{
 const ctx=await socialContext(request);if(ctx.error)return Response.json({error:'Entre na sua conta para assistir.'},{status:ctx.status,headers});
 const body=await request.json();if(!/^[0-9a-f-]{36}$/i.test(body.postId||''))throw Object.assign(Error('Publicação inválida.'),{status:400});
 const {data,error}=await ctx.db.from('posts').select(POST_FIELDS).eq('id',body.postId).is('archived_at',null).maybeSingle();
 if(error)throw error;if(!data||!publicPost(data).media.some(m=>m.url===body.url&&m.type==='video'))throw Object.assign(Error('Vídeo indisponível.'),{status:404});
 const db=getJeniosPayAdmin(),bucket=process.env.SOCIAL_MEDIA_BUCKET||'social-media',base=db.storage.from(bucket).getPublicUrl('').data.publicUrl;
 if(typeof body.url!=='string'||!body.url.startsWith(base))throw Object.assign(Error('Formato externo de vídeo.'),{status:400});
 const path=body.url.slice(base.length);const url=await optimizeStoredVideo(db,bucket,path);
 return Response.json({url},{headers});
 }catch(e){return Response.json({error:e.status?e.message:'Não foi possível otimizar este vídeo agora.'},{status:e.status||503,headers});}}
