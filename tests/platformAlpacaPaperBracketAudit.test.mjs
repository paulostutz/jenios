import test from 'node:test';import assert from 'node:assert/strict';
import {auditAlpacaPaperBracket,inspectPaperBracketReply} from '../lib/platform/connections/alpaca-paper-bracket-audit.mjs';
const env={JENIOS_PRIVATE_PAPER_EXECUTOR:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PAPER_WORKER_SIGNING_KEY_B64:Buffer.alloc(32,4).toString('base64')};
const id='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const credentials={apiKey:'alpaca_qa_key_01234567',secret:'alpaca_qa_secret_01234567'};
const body={symbol:'AAPL',qty:'1',side:'buy',type:'limit',time_in_force:'day',limit_price:'100',order_class:'bracket',take_profit:{limit_price:'104'},stop_loss:{stop_price:'98'},client_order_id:'paper-client-audit-1'};
const parent={id,client_order_id:body.client_order_id,symbol:'AAPL',order_class:'bracket',side:'buy',qty:'1',group_id:'group-p-1',legs:[
 {symbol:'AAPL',side:'sell',qty:'1',type:'limit',limit_price:'104',group_id:'group-p-1',group_role:'take_profit'},
 {symbol:'AAPL',side:'sell',qty:'1',type:'stop',stop_price:'98',group_id:'group-p-1',group_role:'stop_loss'}]};
test('B183 GET broker order with nested legs, failclosed if absent or altered',async()=>{
 let calls=0;const result=await auditAlpacaPaperBracket({body,brokerOrderId:id,credentials},{env,fetcher:async(url,opts)=>{
  calls++;assert.equal(url,'https://paper-api.alpaca.markets/v2/orders/'+id+'?nested=true');assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');return Response.json(parent);
 }});
 assert.equal(calls,1);assert.equal(result.bracketConfirmed,true);assert.equal(result.stopFillGuaranteed,false);
 for(const change of [{...parent,legs:[]},{...parent,legs:[parent.legs[0]]},{...parent,group_id:'other'},{...parent,legs:[parent.legs[0],{...parent.legs[1],stop_price:'101'}]},{...parent,client_order_id:'other'}]){
  const r=inspectPaperBracketReply({parent:change,body,brokerOrderId:id});assert.equal(r.bracketConfirmed,false);assert.equal(r.reviewRequired,true);
 }
});
test('B183 invalid IDs, prod/runtime and error failclosed before any mutable provider method',async()=>{
 let requests=0;const fake=async()=>{requests++;return Response.json(parent,{status:404});};
 await assert.rejects(auditAlpacaPaperBracket({body,brokerOrderId:'../v2/orders',credentials},{env,fetcher:fake}),/INVALID_BRACKET_AUDIT_SCOPE/);
 await assert.rejects(auditAlpacaPaperBracket({body,brokerOrderId:id,credentials},{env:{...env,VERCEL_ENV:'production'},fetcher:fake}),/PRIVATE_PAPER_TRANSPORT_DISABLED/);
 await assert.rejects(auditAlpacaPaperBracket({body,brokerOrderId:id,credentials},{env,fetcher:fake}),/BRACKET_BROKER_LOOKUP_UNCONFIRMED/);
 assert.equal(requests,1);
});
