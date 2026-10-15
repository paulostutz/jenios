'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {createScopedFeedClient} from '../../lib/social/session-client.mjs';
import {createSessionFence} from '../../lib/social/session-fence.mjs';
import {visitorProfile,profileView,postView,commentViews} from '../../lib/social/feed-view.mjs';

// Short-lived memory cache, cleared on identity changes. Never persist another account's feed.
let feedSnapshot=null;
export default function useSocialFeed(){
 const [profile,setProfile]=useState({...visitorProfile}),[posts,setPosts]=useState([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(false);
 const [stories,setStories]=useState([]),[storiesNext,setStoriesNext]=useState(null),[storiesError,setStoriesError]=useState('');
 const [savedPosts,setSavedPosts]=useState([]),[savedNext,setSavedNext]=useState(null);
 const fence=useRef(createSessionFence()),busy=useRef(new Map()),reloadRef=useRef(null),postRevision=useRef(0);
 const clientFor=ticket=>createScopedFeedClient({auth:supabase.auth,fence:fence.current,ticket});
 async function profilesFor(ids){
  if(!ids.length)return new Map();
  const r=await supabase.from('profiles').select('id,handle,display_name,bio,cargo,avatar_url').in('id',[...new Set(ids)]);
  if(r.error)throw Error('Não foi possível carregar os perfis.');
  return new Map((r.data||[]).map(p=>[p.id,p]));
 }
 async function present(rows,ticket){
  const client=clientFor(ticket),ids=rows.map(r=>r.id);
  const [profiles,savedResult,likesResult]=await Promise.all([
   profilesFor(rows.map(x=>x.author_id)),client.savedState(ids).catch(()=>({ids:[]})),client.likesBatch(ids).catch(()=>({stats:[]}))
  ]);
  if(!fence.current.current(ticket))return [];
  const saved=new Set(savedResult.ids),likes=new Map(likesResult.stats.map(x=>[x.post_id,x]));
  return rows.map(row=>({...postView(row,profiles.get(row.author_id)),salvo:saved.has(row.id),likes:likes.has(row.id)?Number(likes.get(row.id).count):null,curtido:likes.get(row.id)?.liked||false}));
 }
 async function load(ticket,after=null){
  const revision=postRevision.current;
  const data=await clientFor(ticket).listPosts({cursor:after});
  if(!fence.current.current(ticket))return;
  const rows=await present(data.posts,ticket);
  if(!fence.current.current(ticket))return;
  if(postRevision.current!==revision)return;
  setPosts(old=>after?[...old,...rows.filter(p=>!old.some(x=>x.id===p.id))]:rows);
  setCursor(data.nextBefore?{before:data.nextBefore,beforeId:data.nextBeforeId}:null);
 }
 useEffect(()=>{
  let live=true;
  async function refresh(){
   if(!live)return;
   let ticket=fence.current.change();
   setProfile({...visitorProfile});setPosts([]);setCursor(null);setError('');setReady(false);setLoading(false);setSavedPosts([]);setSavedNext(null);setStories([]);setStoriesNext(null);setStoriesError('');busy.current.clear();
   try{
    const r=await supabase?.auth.getUser();
    if(!live||!fence.current.current(ticket))return;
    const user=r?.data?.user;
    if(r?.error||!user?.id||user.is_anonymous)return;
    ticket=fence.current.change(user.id);
    if(feedSnapshot?.owner===user.id&&Date.now()-feedSnapshot.savedAt<180000){
      setProfile(feedSnapshot.profile);setPosts(feedSnapshot.posts);setCursor(feedSnapshot.cursor);
      setStories(feedSnapshot.stories);setStoriesNext(feedSnapshot.storiesNext);setReady(true);
    }else feedSnapshot=null;
    const profiles=await profilesFor([user.id]);
    if(!live||!fence.current.current(ticket))return;
    setProfile(profileView(profiles.get(user.id)||{id:user.id,display_name:user.user_metadata?.full_name},true));
    // Feed is visible as soon as posts arrive; counts and Stories load independently.
    const extras=Promise.allSettled([refreshCounts(ticket),loadStories(0,ticket)]);
    await load(ticket);
    if(live&&fence.current.current(ticket))setReady(true);
    await extras;
   }catch{
    if(live&&fence.current.current(ticket))setError('Não foi possível carregar a Social. Tente novamente.');
   }finally{
    if(live&&fence.current.current(ticket))setReady(true);
   }
  }
  reloadRef.current=refresh;
  void refresh();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   // Supabase can emit SIGNED_IN again on window focus; preserve the same account's draft.
   if(session?.user?.id===fence.current.capture().owner&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   feedSnapshot=null;fence.current.change();setPosts([]);setProfile({...visitorProfile});setReady(false);
   setTimeout(()=>{if(live)void refresh();},0);
  });
  return()=>{live=false;reloadRef.current=null;fence.current.change();sub?.data?.subscription?.unsubscribe();};
 },[]);
 useEffect(()=>{
  const ticket=fence.current.capture();
  if(ready&&profile.id&&ticket.owner===profile.id)feedSnapshot={owner:profile.id,profile,posts:posts.slice(0,50),cursor:posts.length>50?null:cursor,stories,storiesNext,savedAt:Date.now()};
 },[ready,profile,posts,cursor,stories,storiesNext]);
 async function action(key,fn){
  const ticket=fence.current.capture();
  if(!ticket.owner)throw Error('Entre na sua conta para continuar.');
  if(busy.current.has(key))throw Error('Aguarde a operação em andamento.');
  busy.current.set(key,ticket);
  try{
   const result=await fn(ticket,clientFor(ticket));
   if(!fence.current.current(ticket))throw Error('A sessão mudou. Confira a operação na conta original.');
   return result;
  }finally{
   if(busy.current.get(key)===ticket)busy.current.delete(key);
  }
 }
 async function publish(body,media){return action('publish',async(ticket,client)=>{
  const r=await client.createPost({body,media});
  if(fence.current.current(ticket)){
   postRevision.current++;
   setPosts(old=>[{...postView(r.post,{id:profile.id,display_name:profile.nome,handle:profile.handle,avatar_url:profile.avatar,bio:profile.bio}),likes:0},...old.filter(p=>p.id!==r.post.id)]);
   setProfile(p=>({...p,postsCount:(p.postsCount||0)+1}));
  }
  return r.post;
 });}
 async function like(post){return action('like:'+post.id,async(ticket,client)=>{
  await(post.curtido?client.unlikePost(post.id):client.likePost(post.id));
  const l=await client.getLikes(post.id);
  if(fence.current.current(ticket))setPosts(old=>old.map(p=>p.id===post.id?{...p,likes:l.count,curtido:l.liked}:p));
 });}
 async function remove(id){return action('delete:'+id,async(ticket,client)=>{
  await client.deletePost(id);
  if(fence.current.current(ticket)){postRevision.current++;setPosts(old=>old.filter(p=>p.id!==id));}
 });}
 async function comments(postId,ticket=fence.current.capture()){
  const r=await clientFor(ticket).listComments(postId);
  if(!fence.current.current(ticket))return;
  const profiles=await profilesFor(r.comments.map(x=>x.author_id));
  if(fence.current.current(ticket))setPosts(old=>old.map(p=>p.id===postId?{...p,comentarios:commentViews(r.comments,profiles)}:p));
 }
 async function comment(postId,body,parentId=null){return action('comment:'+postId,async(ticket,client)=>{
  await client.createComment({postId,body,parentId});await comments(postId,ticket);
 });}
 async function lives(offset=0){return action('lives',async(_ticket,client)=>{const result=await client.lives(offset),profiles=await profilesFor(result.lives.map(x=>x.host_id));return {...result,lives:result.lives.map(x=>({...x,autor:profileView(profiles.get(x.host_id)).nome}))};});}
 async function createLive(data){return action('live-create',async(_ticket,client)=>client.createLive(data));}
 async function deleteLive(id){return action('live-delete:'+id,async(_ticket,client)=>client.deleteLive(id));}
 async function reportLive(id,reason,details){return action('live-report:'+id,async(_ticket,client)=>client.reportLive(id,reason,details));}
 async function blocks(offset=0){return action('blocks',async(_ticket,client)=>client.blocks(offset));}
 async function block(id){return action('block:'+id,async(ticket,client)=>{
  await client.block(id);if(fence.current.current(ticket)){setPosts(old=>old.filter(p=>p.authorId!==id));setSavedPosts(old=>old.filter(p=>p.authorId!==id));setStories(old=>old.filter(p=>p.authorId!==id));}
 });}
 async function unblock(id){return action('unblock:'+id,async(ticket,client)=>{await client.unblock(id);await load(ticket);await loadStories(0,ticket);});}
 async function likeComment(postId,item){return action('comment-like:'+item.id,async(ticket,client)=>{
  await(item.curtido?client.unlikeComment(item.id):client.likeComment(item.id));await comments(postId,ticket);
 });}
 async function report(postId,reason,details){return action('report:'+postId,async(_ticket,client)=>client.report(postId,reason,details));}
 async function removeComment(postId,id){return action('comment-delete:'+id,async(ticket,client)=>{
  await client.deleteComment(id);await comments(postId,ticket);
 });}
 async function openPost(id){return action('open:'+id,async(ticket,client)=>{
  const {post}=await client.getPost(id);const rows=await present([post],ticket);
  if(fence.current.current(ticket))setPosts(old=>old.some(p=>p.id===id)?old:[...rows,...old]);
 });}
 async function loadStories(offset=0,ticket=fence.current.capture()){
  try{
   const result=await clientFor(ticket).stories(offset),profiles=await profilesFor(result.stories.map(x=>x.author_id));
   if(!fence.current.current(ticket))return;
   const rows=result.stories.map(row=>{const p=profileView(profiles.get(row.author_id));return {id:row.id,authorId:row.author_id,autor:p.nome,handle:p.handle,avatar:p.avatar,src:row.media_path,tipo:row.media_type==='video'?'video':'imagem',criadoEm:row.created_at,expiresAt:row.expires_at,sharedPost:row.sharedPost};});
   setStories(old=>offset?[...old,...rows.filter(p=>!old.some(x=>x.id===p.id))]:rows);setStoriesNext(result.nextOffset);setStoriesError('');
  }catch(error){if(fence.current.current(ticket))setStoriesError('Não foi possível carregar os Stories.');throw error;}
 }
 async function createStory(media){return action('story-publish',async(ticket,client)=>{await client.createStory(media);await loadStories(0,ticket);});}
 async function deleteStory(id){return action('story-delete:'+id,async(ticket,client)=>{await client.deleteStory(id);if(fence.current.current(ticket))setStories(old=>old.filter(s=>s.id!==id));});}
 async function refreshCounts(ticket=fence.current.capture()){
  const [counts,own]=await Promise.all([clientFor(ticket).follows(ticket.owner),supabase.from('posts').select('id',{count:'exact',head:true}).eq('author_id',ticket.owner)]);
  if(fence.current.current(ticket))setProfile(p=>({...p,followersCount:counts.followers,followingCount:counts.following,...(!own.error?{postsCount:own.count}: {})}));
 }
 async function save(post,wanted){return action('save:'+post.id,async(ticket,client)=>{
  await(wanted?client.save(post.id):client.unsave(post.id));
  if(fence.current.current(ticket)){
   setPosts(old=>old.map(p=>p.id===post.id?{...p,salvo:wanted}:p));
   setSavedPosts(old=>wanted?(old.some(p=>p.id===post.id)?old:[{...post,salvo:true},...old]):old.filter(p=>p.id!==post.id));
  }
 });}
 async function loadSaved(offset=0){return action('saved',async(ticket,client)=>{
  const result=await client.listSaved(offset),rows=await present(result.posts,ticket);
  if(fence.current.current(ticket)){setSavedPosts(old=>offset?[...old,...rows.filter(p=>!old.some(x=>x.id===p.id))]:rows);setSavedNext(result.nextOffset);}
 });}
 async function visit(person,offset=0){return action('profile:'+person.id+':'+person.handle,async(ticket,client)=>{
  const data=await client.profile(person,offset);const [counts,rows]=await Promise.all([client.follows(data.profile.id),present(data.posts,ticket)]);
  return {profile:{...profileView(data.profile,data.profile.id===ticket.owner),postsCount:data.postsCount,followersCount:counts.followers,followingCount:counts.following,followed:counts.followed},posts:rows,nextOffset:data.nextOffset};
 });}
 async function toggleFollow(person){return action('follow:'+person.id,async(ticket,client)=>{
  await(person.followed?client.unfollow(person.id):client.follow(person.id));
  const counts=await client.follows(person.id);await refreshCounts(ticket);
  return {...person,followersCount:counts.followers,followingCount:counts.following,followed:counts.followed};
 });}
 async function followList(id,kind,offset=0){return action('follow-list',async(_ticket,client)=>client.followList(id,kind,offset));}
 async function more(){
  if(!cursor||loading||busy.current.has('more'))return;
  setLoading(true);setError('');const ticket=fence.current.capture();
  try{await action('more',owner=>load(owner,cursor));}
  catch{if(fence.current.current(ticket))setError('Não foi possível carregar mais publicações. Tente novamente.');}
  finally{if(fence.current.current(ticket))setLoading(false);}
 }
 return {lives,createLive,deleteLive,reportLive,blocks,block,unblock,likeComment,report,stories,storiesNext,storiesError,loadStories,createStory,deleteStory,profile,setProfile,posts,setPosts,ready,error,cursor,loading,more,publish,like,remove,comments,comment,removeComment,openPost,savedPosts,savedNext,save,loadSaved,visit,toggleFollow,followList,retry:()=>reloadRef.current?.()};
}
