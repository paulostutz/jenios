import https from 'node:https';

const HOST = 'cdpj.partners.bancointer.com.br';
const REQUIRED = ['INTER_CLIENT_ID','INTER_CLIENT_SECRET','INTER_CERTIFICATE','INTER_PRIVATE_KEY','INTER_PIX_KEY'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status=502) => Object.assign(new Error(message), {status});
export function interPixConfigured(env=process.env) {
  return env.JENIOS_PAY_PROVIDER === 'inter_pix' && REQUIRED.every(key => typeof env[key]==='string' && env[key].trim());
}
export function pixTxid(orderId) {
  if (!uuid.test(orderId||'')) throw fail('Pedido inválido.',400);
  return orderId.replaceAll('-','').toLowerCase();
}
export function pixCents(value) {
  if (typeof value!=='string'||!/^\d{1,8}\.\d{2}$/.test(value)) throw fail('Valor bancário inválido.');
  return Number(value.replace('.',''));
}
// Only this fixed bank host receives the certificate, private key and OAuth token.
export function interRequest({path,method='GET',body,token,env=process.env}) {
  if (!/^\/(?:oauth\/v2\/token|pix\/v2\/cob\/[a-zA-Z0-9]{26,35})$/.test(path)) throw fail('Operação bancária inválida.');
  const raw=body===undefined?null:typeof body==='string'?body:JSON.stringify(body);
  return new Promise((resolve,reject)=>{
    let timer;
    const req=https.request({hostname:HOST,path,method,cert:env.INTER_CERTIFICATE?.replace(/\\n/g,'\n'),key:env.INTER_PRIVATE_KEY?.replace(/\\n/g,'\n'),rejectUnauthorized:true,
      headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(env.INTER_ACCOUNT_NUMBER?{'x-conta-corrente':env.INTER_ACCOUNT_NUMBER}:{}),...(raw?{'Content-Type':typeof body==='string'?'application/x-www-form-urlencoded':'application/json','Content-Length':Buffer.byteLength(raw)}:{})}},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>262144)res.destroy(fail('Resposta bancária excedeu o limite.'));else chunks.push(chunk);});
      res.on('error',()=>{clearTimeout(timer);reject(fail('Falha ao consultar o banco.'));});
      res.on('end',()=>{clearTimeout(timer);const status=res.statusCode;
        if(status<200||status>=300)return reject(Object.assign(fail(status===401||status===403?'A integração bancária precisa revisar as credenciais e permissões.':'O banco não concluiu a operação. Tente novamente com o mesmo pedido.'),{bankStatus:status}));
        try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(fail('Resposta bancária inválida.'));}
      });
    });
    timer=setTimeout(()=>req.destroy(fail('O banco demorou a responder. Tente novamente com o mesmo pedido.')),15000);
    req.on('error',()=>{clearTimeout(timer);reject(fail('Não foi possível conectar ao banco. Confira a integração e tente novamente.'));});
    req.end(raw);
  });
}
let tokenCache=null, tokenPending=null;
export function createInterPixClient({env=process.env,request=interRequest}={}) {
  async function token() {
    if(!interPixConfigured(env))throw fail('Pagamento Pix temporariamente indisponível.',503);
    // A cache belongs to these exact credentials, including a rotated certificate.
    const identity=REQUIRED.map(k=>env[k]).join('\u0000');
    if(tokenCache?.identity===identity&&tokenCache.until>Date.now())return tokenCache.value;
    if(tokenPending?.identity===identity)return tokenPending.promise;
    const promise=(async()=>{
      const data=await request({path:'/oauth/v2/token',method:'POST',env,body:new URLSearchParams({client_id:env.INTER_CLIENT_ID,client_secret:env.INTER_CLIENT_SECRET,grant_type:'client_credentials',scope:'cob.read cob.write'}).toString()});
      if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(Number(data.expires_in)))throw fail('Autenticação bancária inválida.');
      tokenCache={identity,value:data.access_token,until:Date.now()+Math.max(0,Math.min(Number(data.expires_in)-60,3500))*1000};return data.access_token;
    })();tokenPending={identity,promise};
    try{return await promise;}finally{if(tokenPending?.promise===promise)tokenPending=null;}
  }
  async function call(txid,method='GET',body) {
    try{return await request({path:'/pix/v2/cob/'+txid,method,body,env,token:await token()});}
    catch(error){if(error.bankStatus===401)tokenCache=null;throw error;}
  }
  return {
    read:txid=>call(txid),
    async create(order) {
      if(env.JENIOS_PAY_PAYMENTS_ENABLED!=='true')throw fail('Pagamento temporariamente indisponível.',503);
      const txid=pixTxid(order.orderId);
      try{return await call(txid);}catch(error){if(error.bankStatus!==404)throw error;}
      try{return await call(txid,'PUT',{calendario:{expiracao:3600},valor:{original:(order.amount_cents/100).toFixed(2),modalidadeAlteracao:0},chave:env.INTER_PIX_KEY.trim(),solicitacaoPagador:'Pedido JENIOS '+order.orderId});}
      catch(error){if(error.bankStatus!==409)throw error;return call(txid);}
    }
  };
}
export function verifyPixCharge(charge,order,{env=process.env,now=Date.now()}={}) {
  const txid=pixTxid(order.id||order.orderId);
  if(order.currency!=='BRL'||!Number.isSafeInteger(order.amount_cents)||order.amount_cents<1||charge?.txid!==txid||pixCents(charge?.valor?.original)!==order.amount_cents||charge.chave!==env.INTER_PIX_KEY?.trim())throw fail('A cobrança bancária não corresponde ao pedido.');
  const created=Date.parse(charge.calendario?.criacao),duration=Number(charge.calendario?.expiracao),expires=created+duration*1000;
  if(!Number.isFinite(created)||!Number.isInteger(duration)||duration<1||!Number.isFinite(expires))throw fail('Prazo da cobrança bancária inválido.');
  const status=charge.status;
  if(status==='CONCLUIDA'){
    const receipts=charge.pix;
    if(!Array.isArray(receipts)||receipts.length!==1)throw fail('Pagamento recebido precisa de conferência.');
    const receipt=receipts[0],paidAt=Date.parse(receipt.horario);
    if(receipt.txid!==txid||!/^E[a-zA-Z0-9]{31}$/.test(receipt.endToEndId||'')||pixCents(receipt.valor)!==order.amount_cents||!Number.isFinite(paidAt)||paidAt<created-300000||paidAt>now+300000||(receipt.devolucoes?.length||0)>0)throw fail('Pagamento recebido precisa de conferência.');
    return {status:'paid',txid,paymentId:receipt.endToEndId,paidAt:new Date(paidAt).toISOString()};
  }
  if(status?.startsWith('REMOVIDA_'))return {status:'cancelled',txid};
  if(status!=='ATIVA')throw fail('Situação bancária ainda não reconhecida.');
  if(expires<=now)return {status:'expired',txid};
  if(typeof charge.pixCopiaECola!=='string'||!charge.pixCopiaECola.startsWith('000201')||charge.pixCopiaECola.length>2048)throw fail('O banco ainda não retornou o código Pix. Tente consultar novamente.');
  return {status:'awaiting_payment',txid,pixCode:charge.pixCopiaECola,expiresAt:new Date(expires).toISOString()};
}
export async function createInterCheckout(payload,{db,env=process.env,client=createInterPixClient({env})}={}) {
  if(env.JENIOS_PAY_PAYMENTS_ENABLED!=='true')throw fail('Pagamento temporariamente indisponível.',503);
  if(payload.scope!=='social'||payload.billing_type!=='one_time')throw fail('Este meio de pagamento atende compras avulsas da Social.',503);
  if(!db)throw fail('Serviço de pagamentos indisponível.',503);
  const txid=pixTxid(payload.orderId);
  const {error}=await db.from('jenios_pay_payments').upsert({order_id:payload.orderId,provider:'inter_pix',provider_payment_id:txid,payment_method:'pix',amount_cents:payload.amount_cents,status:'pending'},{onConflict:'provider,provider_payment_id',ignoreDuplicates:true});
  if(error)throw fail('Não foi possível preparar o pagamento. Tente novamente com o mesmo pedido.',503);
  const charge=await client.create(payload);
  verifyPixCharge(charge,payload,{env});
  return {checkoutUrl:'/social/pagamento?pedido='+encodeURIComponent(payload.orderId)};
}
