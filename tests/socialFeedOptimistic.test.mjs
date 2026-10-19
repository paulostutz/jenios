import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {optimisticPostLike,optimisticCommentLike,appendConfirmedComment,hasCommentParent} from '../lib/social/feed-optimistic.mjs';
const s=path=>readFileSync(path,'utf8');
test('B75 post like updates immediately without fabricating unknown count and preserves other posts',()=>{
 const before=[{id:'a',likes:2,curtido:false},{id:'b',likes:null,curtido:false}];
 const liked=optimisticPostLike(before,'a',true);
 assert.equal(liked[0].likes,3);assert.equal(liked[0].curtido,true);
 assert.strictEqual(liked[1],before[1]);assert.equal(before[0].curtido,false);
 assert.deepEqual(optimisticPostLike(liked,'a',false),before);
 assert.equal(optimisticPostLike(before,'b',true)[1].likes,null);
});
test('B75 reply like remains separate from parent and does not alter unrelated posts',()=>{
 const rows=[{id:'post',comentarios:[{id:'parent',likes:4,curtido:false,respostas:[{id:'reply',likes:2,curtido:false}]}]},{id:'other',comentarios:[]}];
 const next=optimisticCommentLike(rows,'post','reply',true);
 assert.equal(next[0].comentarios[0].respostas[0].likes,3);
 assert.equal(next[0].comentarios[0].likes,4);
 assert.strictEqual(next[1],rows[1]);
 assert.equal(optimisticCommentLike(next,'post','reply',false)[0].comentarios[0].respostas[0].likes,2);
});
test('B75 append requires server confirmed ID post owner and timestamp, preserves reply parent',()=>{
 const source=[{id:'post',comentarios:[{id:'parent',respostas:[]}]}];
 const row={id:'new',post_id:'post',author_id:'user',parent_id:'parent',body:'Obrigado!',created_at:'2026-10-19T12:00:00Z'};
 assert.equal(hasCommentParent(source[0],'parent'),true);
 const next=appendConfirmedComment(source,'post',row,{nome:'Tester',handle:'@tester',avatar:'a'});
 assert.equal(next[0].comentarios.length,1);
 assert.equal(next[0].comentarios[0].respostas[0].texto,'Obrigado!');
 assert.equal(next[0].comentarios[0].respostas[0].curtido,false);
 assert.deepEqual(appendConfirmedComment(next,'post',row,{nome:'Tester'}),next);
 assert.deepEqual(appendConfirmedComment(source,'post',{...row,post_id:'other'},{nome:'Tester'}),source);
 assert.deepEqual(appendConfirmedComment(source,'post',{...row,parent_id:'unknown'},{nome:'Tester'}),source);
});
test('B75 mutation hook eliminates redundant post-like GET and thread reload on successful reply',()=>{
 const hook=s('app/components/useSocialFeed.js');
 assert.match(hook,/optimisticPostLike\(old,post\.id,wanted\)/);
 const likeBlock=hook.slice(hook.indexOf('async function like(post)'),hook.indexOf('async function remove('));
 assert.doesNotMatch(likeBlock,/getLikes\(/);
 assert.match(hook,/appendConfirmedComment\(old,postId,row,profile\)/);
 assert.match(hook,/commentRevisions\.current/);
 assert.match(hook,/await comments\(postId,ticket\);return;/);
 assert.match(hook,/optimisticCommentLike/);
});
test('B75 unknown and malformed updates never grant auth or fake execution',()=>{
 const helper=s('lib/social/feed-optimistic.mjs');
 assert.doesNotMatch(helper,/from ['"].*supabase|service_role|executed:\s*true|fetch\(/);
});
