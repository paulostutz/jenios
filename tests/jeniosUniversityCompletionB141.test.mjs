import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRODUCTS,mergeCatalog,normalizePurchase} from '../lib/pay/catalog.mjs';
import {claimVerifiedUniversityPass,universityPaymentWindow} from '../lib/assistant/university-pass.mjs';
import {verifiedUniversityPass,classifyVerifiedPlan} from '../lib/assistant/pro-access.mjs';
import {handleLearning} from '../lib/learning/service.mjs';
import {initialState,dailyStudyPlan,transition} from '../lib/learning/engine.mjs';
import {TRACKS,LESSONS} from '../lib/learning/catalog.mjs';
import {QUESTION_BANK} from '../lib/learning/question-bank.mjs';

const NOW=Date.parse('2026-10-20T12:00:00Z'),DAY=86400000;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const sku={id:'university',code:'social-university-pass',category:'other',active:false,price_cents:0};
const paidAt=new Date(NOW-3600000).toISOString();
const order=(id='order')=>({id,user_id:A,product_id:sku.id,status:'paid',amount_cents:3990,currency:'BRL',created_at:new Date(NOW-7200000).toISOString()});
const receipt=(id='order')=>({order_id:id,status:'confirmed',amount_cents:3990,provider_payment_id:'receipt-'+id,confirmed_at:paidAt});
const entitlement=(id='order')=>({id:'ent-'+id,user_id:A,order_id:id,product_id:sku.id,status:'active',granted_at:paidAt,expires_at:new Date(Date.parse(paidAt)+30*DAY).toISOString()});

/** In-memory relational adapter executes owner/revision filters and uniqueness.
 * It is used only by tests; no real account, subscription or payment is written. */
function database(seed={}){
 const tables={jenios_pay_products:[sku],jenios_pay_subscriptions:[],jenios_pay_orders:[],jenios_pay_payments:[],jenios_pay_entitlements:[],jenios_learning_state:[],...structuredClone(seed)};
 const reads={},failures={};let viewer=A;
 const db={tables,reads,failures,setViewer(id){viewer=id;},auth:{getUser:async()=>({data:{user:{id:viewer,app_metadata:{}}},error:null})},from(table){
  const predicates=[];let write=null,limit=Infinity,sort=null;
  const matches=row=>predicates.every(fn=>fn(row));
  const execute=()=>{
   reads[table]=(reads[table]||0)+1;
   if(failures[table])return {data:null,error:{code:'TEST_UNAVAILABLE'}};
   const rows=tables[table]||(tables[table]=[]);let selected;
   if(write?.type==='insert'){
    if(rows.some(row=>row.user_id===write.data.user_id))return {data:null,error:{code:'23505'}};
    rows.push(structuredClone(write.data));selected=[rows.at(-1)];
   }else if(write?.type==='update'){
    selected=rows.filter(matches);for(const row of selected)Object.assign(row,structuredClone(write.data));
   }else if(write?.type==='upsert'){
    const existing=rows.find(row=>row.order_id===write.data.order_id);
    if(!existing){rows.push({id:'ent-'+write.data.order_id,...structuredClone(write.data)});selected=[rows.at(-1)];}else selected=[];
   }else selected=rows.filter(matches);
   if(sort)selected=[...selected].sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''))*(sort.ascending?1:-1));
   return {data:structuredClone(selected.slice(0,limit)),error:null};
  };
  const q={select(){return q;},eq(key,value){predicates.push(row=>row[key]===value);return q;},in(key,values){predicates.push(row=>values.includes(row[key]));return q;},order(key,{ascending=true}={}){sort={key,ascending};return q;},limit(n){limit=n;return q;},insert(data){write={type:'insert',data};return q;},update(data){write={type:'update',data};return q;},upsert(data){write={type:'upsert',data};return q;},then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);},async maybeSingle(){const result=execute();return {...result,data:result.data?.[0]??null};},async single(){return q.maybeSingle();}};
  return q;
 }};return db;
}

test('B141 an unpriced University pass stays inactive after catalog defaults and cannot enter checkout',()=>{
 const product=DEFAULT_PRODUCTS.find(row=>row.code===sku.code);
 assert.equal(product.active,false);assert.equal(product.price_cents,0);
 assert.equal(mergeCatalog().find(row=>row.code===sku.code).active,false);
 assert.throws(()=>normalizePurchase({},product,'social'),/indisponível/);
 assert.equal(DEFAULT_PRODUCTS.find(row=>row.code==='platform-global-crypto').active,true);
});

test('B141 every University access rechecks payment proof, amount, owner and paid order',async()=>{
 const seed={jenios_pay_orders:[order()],jenios_pay_payments:[receipt()],jenios_pay_entitlements:[entitlement()]};
 const valid=await verifiedUniversityPass(database(seed),A,NOW);assert.equal(valid.kind,'purchased-pass');
 const variants=[
  {table:'jenios_pay_payments',key:'status',value:'refunded'},
  {table:'jenios_pay_payments',key:'amount_cents',value:3989},
  {table:'jenios_pay_payments',key:'provider_payment_id',value:''},
  {table:'jenios_pay_payments',key:'confirmed_at',value:new Date(NOW+1).toISOString()},
  {table:'jenios_pay_orders',key:'status',value:'refunded'},
  {table:'jenios_pay_orders',key:'user_id',value:B},
  {table:'jenios_pay_orders',key:'created_at',value:'invalid'},
  {table:'jenios_pay_entitlements',key:'user_id',value:B},
  {table:'jenios_pay_entitlements',key:'status',value:'revoked'}
 ];
 for(const variant of variants){const db=database(seed);db.tables[variant.table][0][variant.key]=variant.value;assert.equal(await verifiedUniversityPass(db,A,NOW),null,JSON.stringify(variant));}
 const unavailable=database(seed);unavailable.failures.jenios_pay_payments=true;
 await assert.rejects(verifiedUniversityPass(unavailable,A,NOW),{status:503});
});

test('B141 a refunded recent pass does not hide another independently confirmed pass',async()=>{
 const db=database({jenios_pay_orders:[{...order('recent'),status:'refunded'},order('paid')],jenios_pay_payments:[receipt('recent'),receipt('paid')],jenios_pay_entitlements:[{...entitlement('recent'),expires_at:new Date(NOW+40*DAY).toISOString()},entitlement('paid')]});
 assert.equal((await verifiedUniversityPass(db,A,NOW)).orderId,'paid');
});

test('B141 repeats, late duplicated receipts and stored expiry drift cannot renew the same paid pass',async()=>{
 const sale=order(),first=receipt();
 const window=universityPaymentWindow(sale,[{...first,provider_payment_id:'later',confirmed_at:new Date(NOW-1000).toISOString()},first],NOW);
 assert.equal(window.paidAt,Date.parse(paidAt));
 assert.equal(universityPaymentWindow(sale,[first],Date.parse(paidAt)+30*DAY),null);
 const db=database({jenios_pay_orders:[sale],jenios_pay_payments:[first],jenios_pay_entitlements:[{...entitlement(),expires_at:new Date(NOW+365*DAY).toISOString()}]});
 assert.equal((await verifiedUniversityPass(db,A,NOW)).validUntil,new Date(window.expiresAt).toISOString());
 assert.equal(await verifiedUniversityPass(db,A,window.expiresAt),null);
});

test('B141 claiming a confirmed pass is idempotent and never reactivates a revoked purchase',async()=>{
 const db=database({jenios_pay_orders:[order()],jenios_pay_payments:[receipt()]});
 assert.equal(await claimVerifiedUniversityPass(db,A,NOW),true);
 assert.equal(await claimVerifiedUniversityPass(db,A,NOW),false);
 assert.equal(db.tables.jenios_pay_entitlements.length,1);
 db.tables.jenios_pay_entitlements[0].status='revoked';
 assert.equal(await claimVerifiedUniversityPass(db,A,NOW),false);
 assert.equal(await verifiedUniversityPass(db,A,NOW),null);
});

test('B141 equivalent subscription rows resolve to the same cycle regardless of database order',()=>{
 const products=[{id:'p149',code:'platform-global-crypto',category:'platform'}];
 const row=id=>({id,product_id:'p149',status:'active',current_period_start:new Date(NOW-DAY).toISOString(),current_period_end:new Date(NOW+DAY).toISOString()});
 const a=row('a'),b=row('b'),older={...row('c'),current_period_start:new Date(NOW-2*DAY).toISOString()};
 for(const rows of [[a,b,older],[older,b,a],[b,a,older]])assert.equal(classifyVerifiedPlan(rows,products,NOW).subscriptionId,'a');
});

const request=body=>new Request('https://qa.invalid/api/platform/learning',{method:body?'POST':'GET',headers:{authorization:'Bearer test-university-only',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const correctAnswers=quiz=>Object.fromEntries(quiz.questions.map(q=>[q.id,q.order.indexOf(QUESTION_BANK.find(item=>item.id===q.id).answer)]));

test('B141 integrated University journey persists all five tracks, survives renewal and isolates learners',async()=>{
 const product={id:'p149',code:'platform-global-crypto',category:'platform'};
 const subscription={id:'sub-a',user_id:A,product_id:product.id,status:'active',current_period_start:new Date(NOW-DAY).toISOString(),current_period_end:new Date(NOW+31*DAY).toISOString()};
 const db=database({jenios_pay_products:[sku,product],jenios_pay_subscriptions:[subscription]});
 let now=NOW,state;
 async function call(input){const response=await handleLearning(request(input?{revision:state.learning.revision,...input}:null),{db,now,env:{}});assert.equal(response.status,200);state=await response.json();return state;}
 await call();assert.equal(state.learning.onboarding,null);
 await call({action:'onboard',experience:'new',goal:'fundamentals',minutes:20,persona:'genia',aiConsent:false});
 await call({action:'start_quiz',kind:'placement'});
 for(const q of state.learning.quiz.questions)assert.deepEqual(Object.keys(q).sort(),['id','options','prompt']);
 let saved=db.tables.jenios_learning_state.find(row=>row.user_id===A);
 await call({action:'submit_quiz',attemptId:saved.state.pending.id,answers:correctAnswers(saved.state.pending)});
 const placementId=state.result.attemptId;
 await call();assert.equal(state.learning.lastSubmission.attemptId,placementId);
 for(const track of TRACKS){
  for(const lesson of LESSONS.filter(item=>item.trackId===track.id))await call({action:'complete_lesson',lessonId:lesson.id});
  await call({action:'start_quiz',kind:track.id});saved=db.tables.jenios_learning_state.find(row=>row.user_id===A);
  await call({action:'submit_quiz',attemptId:saved.state.pending.id,answers:correctAnswers(saved.state.pending)});
 }
 await call();assert.equal(state.learning.route.filter(track=>track.passed).length,5);
 assert.equal(state.learning.assessmentHistory.length,6);assert.equal(state.learning.executionEnabled,false);
 now=NOW+DAY;await call({action:'review_lesson',lessonId:'mercado'});const savedRevision=state.learning.revision;
 db.tables.jenios_pay_subscriptions[0].current_period_end=new Date(now-1).toISOString();
 const reads=db.reads.jenios_learning_state;
 assert.equal((await handleLearning(request(),{db,now,env:{}})).status,402);
 assert.equal(db.reads.jenios_learning_state,reads);
 db.tables.jenios_pay_subscriptions[0].current_period_start=new Date(now).toISOString();
 db.tables.jenios_pay_subscriptions[0].current_period_end=new Date(now+30*DAY).toISOString();
 await call();assert.equal(state.learning.revision,savedRevision);assert.equal(state.learning.dailyStudy.totalReviewSessions,1);
 assert.equal(state.learning.route.flatMap(track=>track.lessons).filter(lesson=>lesson.completed).length,15);
 db.setViewer(B);db.tables.jenios_pay_subscriptions.push({...subscription,id:'sub-b',user_id:B});await call();
 assert.equal(state.learning.onboarding,null);assert.equal(state.learning.assessmentHistory.length,0);
 assert.equal(db.tables.jenios_learning_state.find(row=>row.user_id===A).state.completedLessons.length,15);
});

test('B141 configured Master access works without subscription and simultaneous writes preserve one revision',async()=>{
 const db=database();let calls=0;
 const options={db,now:NOW,env:{JENIOS_ADMIN_MASTER_USER_IDS:A},teacher:async()=>{calls++;throw Error('Unexpected teacher call');}};
 let response=await handleLearning(request(),options);assert.equal(response.status,200);
 const payload={revision:0,action:'onboard',experience:'new',goal:'fundamentals',minutes:20,persona:'genio',aiConsent:false};
 const results=await Promise.all([handleLearning(request(payload),options),handleLearning(request({...payload,persona:'genia'}),options)]);
 assert.deepEqual(results.map(item=>item.status).sort(),[200,409]);
 response=await handleLearning(request(),options);
 assert.equal((await response.json()).learning.revision,1);assert.equal(calls,0);
});

test('B141 continuous review picks an unreviewed completed lesson before repeating today',()=>{
 let s=initialState();s.onboarding={minutes:20};s.placement={level:'Avançado',byTrack:{}};
 s.completedLessons=LESSONS.map(lesson=>lesson.id);s.mastery=Object.fromEntries(TRACKS.map(track=>[track.id,{passed:true,reviewAt:new Date(NOW+DAY).toISOString()}]));
 const first=dailyStudyPlan(s,NOW).suggestedLesson.id;
 s=transition(s,{action:'review_lesson',lessonId:first},NOW).state;
 assert.notEqual(dailyStudyPlan(s,NOW).suggestedLesson.id,first);
 for(const lesson of LESSONS)s=transition(s,{action:'review_lesson',lessonId:lesson.id},NOW).state;
 assert.equal(dailyStudyPlan(s,NOW).suggestedLesson,null);
 assert.ok(dailyStudyPlan(s,NOW+DAY).suggestedLesson);
});
