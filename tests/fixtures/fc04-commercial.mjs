// Local relational/queue double. It is not evidence of PostgreSQL transitions
// or authenticated provider delivery; every row and credential is invented.
export const NOW=Date.parse('2026-10-23T12:00:00Z');
export const OWNER='fc040000-0000-4000-8000-000000000001';
export const OTHER='fc040000-0000-4000-8000-000000000002';
export const END='2026-11-23T12:00:00Z';
export const emailEnv={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b305-finance-email-20261022',
 VERCEL_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',JENIOS_B305_QA_PROJECT_ID:'prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_PAYMENT_EMAILS_ENABLED:'false',JENIOS_B305_TEST_SEND_APPROVED:'false',
 JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'false',JENIOS_SUBSCRIPTION_DUNNING_ENABLED:'false',
 JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'true',RESEND_API_KEY:'re_fc04_fixture_only',
 SUPABASE_SECRET_KEY:'sb_secret_fc04_fixture_only',JENIOS_PAYMENT_EMAIL_FROM:'Financeiro JENIOS <financeiro@jenios.com.br>',
 JENIOS_RESEND_EXPECTED_DOMAIN:'jenios.com.br',JENIOS_RESEND_DOMAIN_VERIFIED:'true'
};
export function commercialFixture(){
 const user={id:OWNER,email:'customer@example.invalid',email_confirmed_at:'2026-10-22T12:00:00Z',is_anonymous:false,user_metadata:{full_name:'Cliente fictício',registration_source:'social'}};
 const product={id:'fc04-product',code:'platform-global-crypto',name:'Global Crypto',category:'platform',billing_type:'monthly',active:true,price_cents:14990,currency:'BRL'};
 const subscription={id:'fc04-subscription',user_id:OWNER,product_id:product.id,status:'active',latest_order_id:'fc04-order',current_period_start:'2026-10-23T10:00:00Z',current_period_end:END,cancel_at_period_end:false};
 const order={id:'fc04-order',user_id:OWNER,product_id:product.id,status:'paid',currency:'BRL',amount_cents:14990};
 const entitlement={order_id:order.id,user_id:OWNER,product_id:product.id,status:'active'};
 const queue={id:'fc04-queue',lease_token:'fc04-local-lease',user_id:OWNER,subscription_id:subscription.id,product_id:product.id,event_kind:'plan_activated',status:'pending'};
 const tables={jenios_pay_products:[product],jenios_pay_subscriptions:[subscription],jenios_pay_orders:[order],jenios_pay_entitlements:[entitlement],jenios_platform_diagnostics:[]};
 const rpcCalls=[],writes=[];
 const db={viewer:user,failTable:null,tables,rpcCalls,writes,
  auth:{getUser:async()=>({data:{user:db.viewer},error:null}),admin:{getUserById:async(id)=>({data:{user:id===user.id?user:null},error:null})}},
  async rpc(name,args){
   rpcCalls.push({name,args});
   if(name==='jenios_claim_transactional_email_b305'){
    const claimed=queue.status==='pending';if(claimed)queue.status='processing';
    return {data:claimed?[queue]:[],error:null};
   }
   if(name==='jenios_complete_transactional_email_b305'){queue.status='sent';return {data:true,error:null};}
   if(name==='jenios_release_transactional_email_b305'){queue.status=args.p_retryable?'retry':'uncertain';return {data:true,error:null};}
   throw Error('Unexpected fixture RPC '+name);
  },
  from(table){
   const predicates=[];let payload=null,single=false;
   const run=()=>{
    if(db.failTable===table)return {data:null,error:{code:'FC04_FIXTURE_DB_UNAVAILABLE'}};
    if(!(table in tables))throw Error('Unexpected fixture table '+table);
    if(payload){const saved={...payload,created_at:new Date(NOW).toISOString()};tables[table].push(saved);writes.push(table);payload=null;}
    const rows=tables[table].filter(row=>predicates.every(fn=>fn(row)));
    return {data:single?(rows[0]||null):rows,error:null};
   };
   const q={select(){return q;},eq(k,v){predicates.push(r=>r[k]===v);return q;},in(k,v){predicates.push(r=>v.includes(r[k]));return q;},order(){return q;},limit(){return q;},insert(p){payload=p;return q;},async maybeSingle(){single=true;return run();},then(resolve,reject){return Promise.resolve().then(run).then(resolve,reject);}};
   return q;
  }
 };
 return {db,user,product,subscription,order,entitlement,queue};
}
