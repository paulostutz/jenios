/** Verified, local-only UI projections. Server confirms every write.
 * Never manufactures payment, execution or social permission evidence.
 */
export function optimisticPostLike(rows,postId,wanted){
 return rows.map(post=>{
  if(post.id!==postId||Boolean(post.curtido)===wanted)return post;
  const likes=Number.isFinite(post.likes)&&post.likes>=0?
   Math.max(0,post.likes+(wanted?1:-1)):post.likes;
  return {...post,curtido:wanted,likes};
 });
}
export function optimisticCommentLike(rows,postId,commentId,wanted){
 return rows.map(post=>{
  if(post.id!==postId)return post;
  const change=item=>{
   if(item.id!==commentId||Boolean(item.curtido)===wanted)return item;
   return {...item,curtido:wanted,
    likes:Number.isFinite(item.likes)?Math.max(0,item.likes+(wanted?1:-1)):item.likes};
  };
  return {...post,comentarios:(post.comentarios||[]).map(c=>{
   const parent=change(c);
   const replies=(parent.respostas||[]).map(change);
   return replies.some((v,i)=>v!==(parent.respostas||[])[i])?
    {...parent,respostas:replies}:parent;
  })};
 });
}
export function hasCommentParent(post,parentId){
 return Boolean(post?.comentarios?.some(c=>c.id===parentId));
}
/** Use the row returned by the server; never show an unconfirmed pending reply. */
export function appendConfirmedComment(rows,postId,serverRow,profile){
 if(!serverRow?.id||!serverRow?.post_id||serverRow.post_id!==postId||
    !serverRow.author_id||!serverRow.created_at||typeof serverRow.body!=='string')return rows;
 const view={id:serverRow.id,authorId:serverRow.author_id,parentId:serverRow.parent_id||null,
  autor:profile?.nome||'Usuário JENIOS',handle:profile?.handle||'@usuario',
  avatar:profile?.avatar||'',texto:serverRow.body,
  criadoEm:serverRow.created_at,likes:0,curtido:false,respostas:[]};
 return rows.map(post=>{
  if(post.id!==postId)return post;
  const comments=post.comentarios||[];
  if(comments.some(c=>c.id===view.id||(c.respostas||[]).some(r=>r.id===view.id)))return post;
  if(!view.parentId)return {...post,comentarios:[...comments,view]};
  if(!hasCommentParent(post,view.parentId))return post;
  return {...post,comentarios:comments.map(c=>c.id===view.parentId?
    {...c,respostas:[...(c.respostas||[]),view]}:c)};
 });
}
