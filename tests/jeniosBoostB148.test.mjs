import test from 'node:test';
import assert from 'node:assert/strict';
import {WHATSAPP_COUNTRIES,whatsappDestination} from '../lib/social/boost-whatsapp.mjs';
import {boostDemographicTarget,boostViewerDemographics,boostAudienceMatches} from '../lib/social/boost-audience.mjs';
import {purchaseQuote,purchaseFingerprint} from '../lib/pay/purchase.mjs';
import {DEFAULT_PRODUCTS,normalizePurchase} from '../lib/pay/catalog.mjs';
import {serveBoost} from '../lib/social/boost-serving.mjs';
import {boostReadiness} from '../lib/social/boost-readiness.mjs';
import {publicPost} from '../lib/social/schema.mjs';
const postId='b1480000-0000-4000-8000-000000000001',owner='b1480000-0000-4000-8000-000000000002',viewer='b1480000-0000-4000-8000-000000000003';
const product=DEFAULT_PRODUCTS.find(p=>p.code==='social-boost');
const target={postId,dailyBudget:'25.00',days:7,objective:'profile',country:'Brasil',region:'',city:''};
test('B148 Brazil is the first default country and wa.me combines country and national number',()=>{
 assert.equal(WHATSAPP_COUNTRIES[0].code,'BR');
 assert.equal(whatsappDestination('BR','(11) 99999-9999'),'https://wa.me/5511999999999');
 assert.equal(whatsappDestination('BR','11 3333-3333'),'https://wa.me/551133333333');
 assert.equal(whatsappDestination('PT','912 345 678'),'https://wa.me/351912345678');
 assert.equal(whatsappDestination('US','202-555-0123'),'https://wa.me/12025550123');
 assert.equal(whatsappDestination('OTHER','555123456','998'),'https://wa.me/998555123456');
});
test('B148 malformed phone, duplicated Brazil DDI, unsafe links and overflow fail before checkout',()=>{
 for(const value of ['', '+55 11 99999-9999','5511999999999','https://wa.me/5511999999999','11 abc 99999','00000000000','11999'])assert.throws(()=>whatsappDestination('BR',value));
 assert.throws(()=>whatsappDestination('FAKE','1234567890'));
 assert.throws(()=>whatsappDestination('OTHER','1234567890','+55'));
 assert.throws(()=>whatsappDestination('OTHER','123456789012345','9999'));
});
test('B148 demographic target preserves old empty defaults and validates restrictive fields',()=>{
 assert.deepEqual(boostDemographicTarget(target),{});
 assert.deepEqual(boostDemographicTarget({ageMin:18,ageMax:65,sex:'female'}),{ageMin:18,ageMax:65,sex:'female'});
 for(const bad of [{ageMin:17,ageMax:20},{ageMin:65,ageMax:18},{ageMin:18.5,ageMax:20},{ageMin:'18',ageMax:65},{ageMin:18},{ageMax:65},{ageMin:18,ageMax:121},{sex:'inferred'}])assert.throws(()=>boostDemographicTarget(bad));
});
test('B148 voluntary demographics reject invalid inputs without inventing values',()=>{
 assert.deepEqual(boostViewerDemographics({}),{age:null,sex:'unknown'});
 assert.deepEqual(boostViewerDemographics({age:30,sex:'other'}),{age:30,sex:'other'});
 for(const bad of [{age:17},{age:'25'},{age:NaN},{age:121},{sex:'all'},{sex:'guessed'}])assert.throws(()=>boostViewerDemographics(bad));
});
test('B148 restrictive audiences fail closed for unknown age or sex, include boundaries, and never block legacy open audiences',()=>{
 assert.equal(boostAudienceMatches(target,{}),true);
 assert.equal(boostAudienceMatches({ageMin:null,ageMax:null,sex:'all'},{}),true);
 for(const audience of [{},{age:30},{age:17,sex:'female'},{age:66,sex:'female'},{age:30,sex:'male'}])assert.equal(boostAudienceMatches({ageMin:18,ageMax:65,sex:'female'},audience),false);
 for(const age of [18,30,65])assert.equal(boostAudienceMatches({ageMin:18,ageMax:65,sex:'female'},{age,sex:'female'}),true);
 assert.equal(boostAudienceMatches({sex:'female'},{age:null,sex:'female'}),true);
});
test('B148 canonical quote binds age and sex into the immutable purchase fingerprint',()=>{
 const old=purchaseQuote({productCode:'social-boost',target},product,'social');
 assert.deepEqual(old,normalizePurchase({target},product,'social'));
 const one=purchaseQuote({productCode:'social-boost',target:{...target,ageMin:18,ageMax:45,sex:'male'}},product,'social');
 const two=purchaseQuote({productCode:'social-boost',target:{...target,ageMin:18,ageMax:65,sex:'male'}},product,'social');
 assert.equal(one.amount_cents,17500);assert.equal(one.target.sex,'male');assert.equal(one.target.ageMax,45);
 assert.notEqual(purchaseFingerprint(one),purchaseFingerprint(two));
 assert.throws(()=>purchaseQuote({target:{...target,ageMin:65,ageMax:18}},product,'social'));
});
test('B148 all four objectives retain canonical payment amount and destination',()=>{
 for(const objective of ['profile','website','whatsapp','copy']){
  const destination=objective==='whatsapp'?whatsappDestination('BR','11999999999'):'https://example.com/proposta';
  const quote=purchaseQuote({target:{...target,objective,...(objective==='profile'?{}:{destination}),ageMin:null,ageMax:null,sex:'all'}},product,'social');
  assert.equal(quote.amount_cents,17500);assert.equal(quote.target.objective,objective);if(objective!=='profile')assert.equal(quote.target.destination,destination);
 }
});
test('B148 server filters incompatible candidates before post reads and delivery proof',async()=>{
 let read=0;const campaign={order_id:postId,owner_id:owner,post_id:postId,revision:1,target:{...target,ageMin:25,ageMax:45,sex:'female'}};
 const db={rpc:async()=>({data:[campaign],error:null})};
 const viewerDb={from(){read++;throw Error('Restricted post must not be read');}};
 for(const body of [{country:'Brasil'},{country:'Brasil',age:24,sex:'female'},{country:'Brasil',age:30,sex:'male'}])assert.deepEqual(await serveBoost({db,viewerDb,user:{id:viewer},body}),{ad:null});
 assert.equal(read,0);
});
test('B148 eligible audience still passes through viewer RLS and signed-proof contract',async()=>{
 const campaign={order_id:postId,owner_id:owner,post_id:postId,revision:1,target:{...target,ageMin:25,ageMax:45,sex:'female'}};
 let rlsReads=0;
 const db={rpc:async()=>({data:[campaign],error:null})};
 const viewerDb={from(table){rlsReads++;const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:table==='posts'?{id:postId,author_id:owner,body:'Fixture',created_at:'2026-10-20',media_path:null,media_type:null,archived_at:null}:{display_name:'Fictitious advertiser',handle:'fixture'},error:null})};return q;}};
 const result=await serveBoost({db,viewerDb,user:{id:viewer},body:{country:'Brasil',age:30,sex:'female'},env:{JENIOS_BOOST_SIGNING_SECRET:'f'.repeat(32)}});
 assert.equal(rlsReads,2);assert.equal(result.ad.campaignId,postId);assert.match(result.ad.proof,/\./);assert.equal(result.ad.post.body,'Fixture');
});
test('B148 readiness never activates missing financial configuration or returns a secret',()=>{
 const result=boostReadiness({});assert.equal(result.ready,false);assert.doesNotMatch(JSON.stringify(result),/API_TOKEN|SIGNING_SECRET|CLIENT_SECRET/);
 const env={JENIOS_PAY_CHECKOUT_URL:'https://example.com/checkout',JENIOS_PAY_API_TOKEN:'fixture-token',JENIOS_BOOST_CAMPAIGNS_ENABLED:'true',NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED:'true',JENIOS_BOOST_SIGNING_SECRET:'s'.repeat(32)};
 assert.equal(boostReadiness(env).ready,true);
 assert.equal(boostReadiness({...env,JENIOS_BOOST_CAMPAIGNS_ENABLED:'false'}).ready,false);
 assert.equal(boostReadiness({...env,NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED:'false'}).ready,false);
 assert.equal(boostReadiness({...env,JENIOS_BOOST_SIGNING_SECRET:''}).ready,false);
});
test('B148 preview uses the existing canonical post decoder, including plain text and archived flags',()=>{
 const decoded=publicPost({id:postId,author_id:owner,body:'A publicação selecionada',created_at:'2026-10-20',media_path:null,media_type:null,archived_at:null});
 assert.equal(decoded.body,'A publicação selecionada');assert.deepEqual(decoded.media,[]);assert.equal(decoded.id,postId);
});
