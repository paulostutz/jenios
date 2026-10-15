// Translate server records to the approved Social card layout; identity comes from UUIDs.
export const visitorProfile = Object.freeze({id:null,nome:'Visitante',handle:'@visitante',cargo:'',avatar:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" rx="40" fill="%23ede9fe"/%3E%3Ccircle cx="40" cy="29" r="14" fill="%237c3aed"/%3E%3Cpath d="M14 70a26 26 0 0 1 52 0" fill="%237c3aed"/%3E%3C/svg%3E',bio:'',seguidoresLista:[],seguindoLista:[],postsCount:0,visualizacoes30Dias:null,status:'',autenticado:false});
export function profileView(row, authenticated=false){
  if(!row?.id)return {...visitorProfile};
  return {...visitorProfile,id:row.id,userId:row.id,nome:row.display_name||'Usuário JENIOS',handle:row.handle?'@'+row.handle.replace(/^@/,''):'@'+row.id.slice(0,8),bio:row.bio||'',avatar:row.avatar_url||visitorProfile.avatar,autenticado:authenticated};
}
export function youtubeFromBody(body=''){
  const last=body.trim().split(/\n/).at(-1);
  try{
    const url=new URL(last);if(!['https:','http:'].includes(url.protocol))return '';
    const host=url.hostname.toLowerCase().replace(/^www\./,'');
    const id=host==='youtu.be'?url.pathname.slice(1):['youtube.com','m.youtube.com'].includes(host)?(url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]):null;
    return /^[A-Za-z0-9_-]{11}$/.test(id||'')?`https://www.youtube.com/watch?v=${id}`:'';
  }catch{return '';}
}
export function postView(row,profile){
  const author=profileView(profile||{id:row.author_id});
  return {id:row.id,authorId:row.author_id,remote:true,autor:author.nome,handle:author.handle,avatar:author.avatar,bio:author.bio,cargo:'',texto:row.body||'',imagens:(row.media||[]).map(x=>({src:x.url||x.src,tipo:x.type==='video'?'video':'imagem',remote:true})),youtubeUrl:youtubeFromBody(row.body),tempo:new Date(row.created_at).toLocaleString('pt-BR'),likes:null,curtido:false,views:null,comentarios:[],perfilAssociado:author};
}
export function commentViews(rows,profiles){
  const items=rows.map(row=>{const p=profileView(profiles.get(row.author_id)||{id:row.author_id});return {id:row.id,authorId:row.author_id,parentId:row.parent_id,autor:p.nome,handle:p.handle,avatar:p.avatar,texto:row.body,criadoEm:row.created_at,likes:Number(row.likes||0),curtido:Boolean(row.liked),respostas:[]};});
  const byId=new Map(items.map(x=>[x.id,x]));
  for(const item of items)if(item.parentId&&byId.has(item.parentId))byId.get(item.parentId).respostas.push(item);
  return items.filter(x=>!x.parentId);
}
