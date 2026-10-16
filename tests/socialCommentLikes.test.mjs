import test from 'node:test';import assert from 'node:assert/strict';
import {commentViews} from '../lib/social/feed-view.mjs';
test('comment and reply preserve separate server like counts and ownership state',()=>{
 const rows=commentViews([{id:'c',author_id:'a',parent_id:null,body:'comment',likes:3,liked:true},{id:'r',author_id:'b',parent_id:'c',body:'reply',likes:7,liked:false}],new Map());
 assert.equal(rows.length,1);assert.equal(rows[0].likes,3);assert.equal(rows[0].curtido,true);assert.equal(rows[0].respostas[0].likes,7);assert.equal(rows[0].respostas[0].curtido,false);
});
