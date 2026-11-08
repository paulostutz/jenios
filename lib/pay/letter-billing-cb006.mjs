import {createCentralBillingClient} from './central-billing-client.mjs';
import {requirePayUser,isFinanceAdmin} from './auth.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const codes=['platform-nacional','platform-global-crypto','platform-internacional-pro','social-university-monthly'];
export const LETTER_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization, X-Platform-Authorization, Origin','X-Content-Type-Options':'nosniff'};
const fail=(code,status=409)=>Object.assign(Error(code),{code,status});
const messages={AUTH_REQUIRED:'Entre novamente para consultar suas cobranças.',REQUEST_INVALID:'Confira os dados enviados.',BILLING_NOT_READY:'A cobrança pela Letter está em configuração.',REQUEST_REFUSED:'Não foi possível validar o pedido. Confira a oferta e o vínculo das contas.',OUTCOME_UNKNOWN:'O resultado ainda está em conferência. Consulte a mesma cobrança antes de emitir outra.'};
export async function letterRpc(db,user,action,data={},platform=null){const r=await db.rpc('jenios_letter_billing_cb006',{p_user:user,p_action:action,p_data:data,p_platform:platform});if(r.error||!r.data)throw fail('REQUEST_REFUSED');return r.data;}
export async function letterNativeAccess(db,userId,{scope='platform',env=process.env}={}){
 if(env.JENIOS_LETTER_INTEGRATION_ENABLED!=='true')return null;
 const state=await letterRpc(db,userId,'status',{scope});return state.access||null;
}
export async function handleLetterBilling(request,{db,platformDb,env=process.env,authorize=requirePayUser,clientFactory=createCentralBillingClient,fetchImpl=fetch}={}){
 const reply=(body,status=200)=>Response.json(body,{status,headers:LETTER_HEADERS});
 try{
  const url=new URL(request.url);
  if(!['GET','POST'].includes(request.method))throw fail('REQUEST_INVALID',405);
  if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||!/^application\/json(?:;.*)?$/i.test(request.headers.get('content-type')||'')))throw fail('REQUEST_INVALID',403);
  let input={action:'status'};
  if(request.method==='GET'){if(url.search)throw fail('REQUEST_INVALID',400);}
  else {if(url.search)throw fail('REQUEST_INVALID',400);const body=await request.text();if(body.length>8192)throw fail('REQUEST_INVALID',413);try{input=JSON.parse(body)}catch{throw fail('REQUEST_INVALID',400)};}
  if(!input||Array.isArray(input)||!['status','quote','prepare','refresh','cancel'].includes(input.action))throw fail('REQUEST_INVALID',400);
  const keys=input.action==='quote'?['action','product_code']:input.action==='prepare'?['action','request_key','offer','payer','accept']:input.action==='status'?['action']:['action','order_id'];
  if(Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>!(k in input)))throw fail('REQUEST_INVALID',400);
  const user=await authorize(request,db);if(!UUID.test(user?.id||'')||user.is_anonymous)throw fail('AUTH_REQUIRED',401);
  const rpc=(action,data={},platform=null)=>letterRpc(db,user.id,action,data,platform);
  const state=await rpc('status');
  const configured=env.JENIOS_LETTER_BILLING_ENABLED==='true'&&UUID.test(env.JENIOS_LETTER_RECEIVER_ID||'')&&state.receiver_id===env.JENIOS_LETTER_RECEIVER_ID;
  if(input.action==='status')return reply({...state,available:state.available===true&&configured});
  if(!configured||state.available!==true)throw fail('BILLING_NOT_READY',503);
  let platform=null;
  const code=input.product_code||input.offer?.product_code;
  if(['quote','prepare'].includes(input.action)){
   if(!codes.includes(code))throw fail('REQUEST_INVALID',400);
   if(code.startsWith('platform-')){
    const auth=request.headers.get('x-platform-authorization');if(!auth)throw fail('AUTH_REQUIRED',401);
    platform=await authorize(new Request(request.url,{headers:{Authorization:auth}}),platformDb);
    if(!UUID.test(platform?.id||'')||platform.is_anonymous)throw fail('AUTH_REQUIRED',401);
   }
  }
  if(['quote','prepare'].includes(input.action)&&!(/^[A-Za-z0-9_-]{43,128}$/).test((code==='social-university-monthly'?env.JENIOS_LETTER_UNIVERSITY_SERVICE_TOKEN:env.JENIOS_LETTER_SERVICE_TOKEN)||''))throw fail('BILLING_NOT_READY',503);
  if(input.action==='quote')return reply(await rpc('quote',{product_code:code},platform?.id));
  if(input.action==='prepare'&&(!UUID.test(input.request_key||'')||input.accept!==true||!input.payer||typeof input.payer!=='object'))throw fail('REQUEST_INVALID',400);
  if(['refresh','cancel'].includes(input.action)&&!UUID.test(input.order_id||''))throw fail('REQUEST_INVALID',400);
  if(input.action==='cancel')return reply(await rpc('cancel',{order_id:input.order_id}));
  const order=await rpc(input.action==='prepare'?'prepare':'read',input.action==='prepare'?{request_key:input.request_key,offer:input.offer,payer:input.payer,accept:true}:{order_id:input.order_id},platform?.id);
  if(!UUID.test(order.id)||order.user_id!==user.id||order.input?.customer_id!==user.id||order.input?.external_invoice_id!==order.id||order.receiver_id!==state.receiver_id)throw fail('REQUEST_REFUSED');
  const purpose=order.product_code==='social-university-monthly'?'jenios_subscription':'jenios_platform_subscription';
  const token=purpose==='jenios_subscription'?env.JENIOS_LETTER_UNIVERSITY_SERVICE_TOKEN:env.JENIOS_LETTER_SERVICE_TOKEN;
  const scope={product:'jenios',company_id:'letter-franqueadora',purpose,receiver_id:order.receiver_id,legal_entity_id:'br:cnpj:57255607000130'};
  const journal={reserve:x=>rpc('claim',{order_id:order.id,operation_key:x.operation_key,phase:x.phase,fingerprint:x.fingerprint}),record:x=>rpc('journal',{order_id:order.id,operation_key:x.operation_key,phase:x.phase,state:x.state,invoice_id:x.invoice_id||null})};
  const client=clientFactory({origin:'https://plataformaletter.com.br',token,scope,journal,fetchImpl});
  let receipt=input.action==='prepare'?await client.prepare(order.input,'jenios:'+order.id):order.central_id?await client.read(order.central_id,order.input):await client.recover('jenios:'+order.id,order.input);
  await rpc('journal',{order_id:order.id,operation_key:'jenios:'+order.id,phase:'prepare',state:'confirmed',invoice_id:receipt.id});
  const live=await authorize(request,db);if(live.id!==user.id)throw fail('AUTH_REQUIRED',401);
  if(receipt.state==='prepared')receipt=order.cancelled?await client.voidUnsent(receipt.id,order.input):await client.issue(receipt.id,order.input);
  if(['submitted','uncertain','issued'].includes(receipt.state))receipt=await client.reconcile(receipt.id,order.input);
  if((await authorize(request,db)).id!==user.id)throw fail('AUTH_REQUIRED',401);
  await rpc('receipt',{order_id:order.id,receipt});return reply(await rpc('status'));
 }catch(e){const code=messages[e.code]?e.code:e.code?.includes('CENTRAL')?'OUTCOME_UNKNOWN':'REQUEST_REFUSED';return reply({ok:false,code,error:messages[code]},[400,401,403,404,405,409,413,415,429,502,503].includes(e.status)?e.status:503);}
}
