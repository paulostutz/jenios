import { validatePostPayload } from './post-validation.mjs';
export const POST_FIELDS='id,author_id,body,media_type,media_path,created_at,archived_at';
export function storedMedia(media=[]) {
  if(!media.length)return {media_type:null,media_path:null};
  const normalized=media.map(item=>({url:item.url||item.src,type:item.type||(item.tipo==='video'?'video':'image')}));
  if(normalized.length===1)return {media_type:normalized[0].type,media_path:normalized[0].url};
  return {media_type:normalized.every(item=>item.type==='image')?'image':'video',media_path:JSON.stringify(normalized)};
}
export function publicPost(row) {
  let media=[];
  if(row.media_path){
    try{const parsed=JSON.parse(row.media_path);if(Array.isArray(parsed))media=parsed;}catch{media=[{url:row.media_path,type:row.media_type||'image'}]}
  }
  if(validatePostPayload({body:row.body||'',media}))media=[];
  return {id:row.id,author_id:row.author_id,body:row.body,media,created_at:row.created_at,archived_at:row.archived_at||null};
}
