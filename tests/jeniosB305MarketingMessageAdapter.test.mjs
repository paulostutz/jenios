import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketingMessage} from '../lib/email/marketing-message-adapter.mjs';

const preference={user_id:'u1',marketing_opt_in:true,opted_out_at:null,complaint_at:null,hard_bounce_at:null};

test('B305-R30 cart adapter requires active monthly Platform product and open order',()=>{
 const row={campaign_kind:'cart_recovery',step:1,user_id:'u1',campaign_key:'o1',order_id:'o1',product_id:'p1'};
 const order={id:'o1',user_id:'u1',product_id:'p1',status:'awaiting_payment'};
 const product={id:'p1',name:'Plano JENIOS',category:'platform',billing_type:'monthly',active:true};
 const msg=buildMarketingMessage({row,preference,to:'Cliente@example.com',order,product});
 assert.equal(msg.to,'cliente@example.com');
 assert.match(msg.subject,/JENIOS/);
 assert.match(msg.html,/Gerenciar preferências/);
 assert.throws(()=>buildMarketingMessage({row,preference,to:'cliente@example.com',order:{...order,status:'paid'},product}),/MARKETING_CART_CONTEXT_INVALID/);
});

test('B305-R30 nurture adapter stops when user has active plan',()=>{
 const row={campaign_kind:'no_plan_nurture',step:1,user_id:'u1',campaign_key:'u1'};
 const msg=buildMarketingMessage({row,preference,to:'cliente@example.com',hasActivePlan:false});
 assert.match(msg.subject,/JENIOS/);
 assert.throws(()=>buildMarketingMessage({row,preference,to:'cliente@example.com',hasActivePlan:true}),/MARKETING_NOT_ELIGIBLE|MARKETING_NURTURE_CONTEXT_INVALID/);
});

test('B305-R30 newsletter requires approved due edition and HTTPS sources',()=>{
 const now=Date.parse('2026-10-23T02:00:00Z');
 const row={campaign_kind:'newsletter',step:0,user_id:'u1',campaign_key:'radar-1',newsletter_edition_id:'e1'};
 const newsletter={id:'e1',edition_key:'radar-1',status:'approved',scheduled_at:'2026-10-23T01:00:00Z',
  items:[{title:'Mercado',summary:'Resumo',sourceName:'Fonte',sourceUrl:'https://example.com/news'}]};
 const msg=buildMarketingMessage({row,preference,to:'cliente@example.com',newsletter,now});
 assert.match(msg.subject,/Radar de Mercado/);
 assert.throws(()=>buildMarketingMessage({row,preference,to:'cliente@example.com',
  newsletter:{...newsletter,items:[{...newsletter.items[0],sourceUrl:'http://example.com'}]},now}),/NEWSLETTER_SOURCE_URL_INVALID/);
});

test('B305-R30 consent and frequency caps are revalidated before message creation',()=>{
 const row={campaign_kind:'newsletter',step:0,user_id:'u1',campaign_key:'radar-1',newsletter_edition_id:'e1'};
 const newsletter={id:'e1',edition_key:'radar-1',status:'approved',scheduled_at:'2026-10-20T01:00:00Z',
  items:[{title:'Mercado',summary:'Resumo',sourceName:'Fonte',sourceUrl:'https://example.com/news'}]};
 const now=Date.parse('2026-10-23T02:00:00Z');
 assert.throws(()=>buildMarketingMessage({row,preference:{...preference,marketing_opt_in:false},to:'cliente@example.com',newsletter,now}),/MARKETING_NOT_ELIGIBLE/);
 assert.throws(()=>buildMarketingMessage({row,preference,to:'cliente@example.com',newsletter,now,lastSentAt:'2026-10-22T02:00:00Z'}),/MARKETING_NOT_ELIGIBLE/);
});
