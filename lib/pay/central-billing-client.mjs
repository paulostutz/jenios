// Server-only adapter. Each product supplies a durable database journal and its own authenticated scope.
const PURPOSES=Object.freeze({chefe:['chefe_subscription','chefe_company_receivable'],treino_possivel:['treino_web_subscription','treino_web_credits'],jenios:['jenios_subscription','jenios_report','jenios_platform_subscription','jenios_own_report'],kivoryn_flow:['flow_monthly_subscription'],kivoryn:['kivoryn_project','kivoryn_maintenance'],sync:['sync_subscription'],kivoryn_wallet:['wallet_service_subscription'],kivoryn_exchange:['exchange_service_subscription']});
const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))):value;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))))),x=>x.toString(16).padStart(2,'0')).join('');
const error=(code,status=409)=>Object.assign(new Error(code),{code,status});
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);

export function assertReceipt(receipt,expected){
 if(!receipt||receipt.schema_version!==1||!identifier(receipt.id)||!['prepared','sending','submitted','uncertain','issued','paid','closed','void'].includes(receipt.state))throw error('INVALID_CENTRAL_RECEIPT',502);
 for(const key of ['product','company_id','purpose','external_invoice_id','customer_id','receiver_id','legal_entity_id','amount_cents','currency','period_start','period_end']){
  if(expected[key]===undefined||receipt[key]!==expected[key])throw error('CENTRAL_RECEIPT_MISMATCH',502);
 }
 if(receipt.verified_paid===true&&(receipt.state!=='paid'||!/^[a-f0-9]{64}$/.test(receipt.proof_sha256??'')||!Number.isFinite(Date.parse(receipt.confirmed_at))))throw error('UNVERIFIED_CENTRAL_PAYMENT',502);
 return receipt;
}
export function paidPeriod(receipt,expected,now=Date.now()){
 assertReceipt(receipt,expected);
 const start=Date.parse(receipt.period_start),end=Date.parse(receipt.period_end);
 if(receipt.state!=='paid'||receipt.verified_paid!==true||!Number.isFinite(start)||!Number.isFinite(end)||!(start<=now&&now<end))return null;
 return Object.freeze({invoice_id:receipt.id,customer_id:receipt.customer_id,start:receipt.period_start,end:receipt.period_end,proof_sha256:receipt.proof_sha256});
}
export function createCentralBillingClient({origin,token,scope,journal,fetchImpl=fetch,timeoutMs=15000}){
 if(typeof window!=='undefined')throw error('SERVER_ONLY');
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw error('INVALID_CENTRAL_ORIGIN');
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(token??''))throw error('SERVICE_CREDENTIAL_REQUIRED');
 if(!scope||!PURPOSES[scope.product]?.includes(scope.purpose)||!identifier(scope.company_id)||!identifier(scope.receiver_id)||!identifier(scope.legal_entity_id))throw error('EXPLICIT_RECEIVER_SCOPE_REQUIRED');
 if(typeof journal?.reserve!=='function'||typeof journal?.record!=='function')throw error('DURABLE_JOURNAL_REQUIRED');
 async function request(method,path,body,key){
  let r;
  try{r=await fetchImpl(new URL('/api/internal/group-billing/v1'+path,url),{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{authorization:'Bearer '+token,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},...(method==='POST'?{body:JSON.stringify(body??{})}:{})});}
  catch{throw error('CENTRAL_OUTCOME_UNKNOWN',503);}
  if(!r.ok)throw error(r.status===404?'CENTRAL_NOT_FOUND':r.status>=500?'CENTRAL_OUTCOME_UNKNOWN':'CENTRAL_REQUEST_REFUSED',r.status);
  const text=await r.text();if(text.length>131072)throw error('INVALID_CENTRAL_RECEIPT',502);
  try{return JSON.parse(text);}catch{throw error('INVALID_CENTRAL_RECEIPT',502);}
 }
 const expected=input=>({...scope,...Object.fromEntries(['external_invoice_id','customer_id','amount_cents','currency','period_start','period_end'].map(k=>[k,input[k]]))});
 return Object.freeze({
  async prepare(input,operationKey){
   if(!identifier(operationKey)||operationKey.length<16)throw error('INVALID_OPERATION_KEY');
   const fingerprint=await hash({scope,input});
   // reserve must atomically insert once and reject digest conflicts; return {created:false} on repeats.
   const reservation=await journal.reserve({scope,operation_key:operationKey,fingerprint,phase:'prepare'});
   if(!reservation||typeof reservation.created!=='boolean')throw error('JOURNAL_RESERVATION_INVALID');
   if(!reservation.created)return this.recover(operationKey,input);
   let result;
   try{result=assertReceipt(await request('POST','/invoices',input,operationKey),expected(input));}
   catch(e){await journal.record({scope,operation_key:operationKey,phase:'prepare',state:'unknown'});throw e;}
   await journal.record({scope,operation_key:operationKey,phase:'prepare',state:'confirmed',invoice_id:result.id});return result;
  },
  async recover(operationKey,input){
   // A 404 after a lost response is unresolved. It never causes a second POST.
   try{return assertReceipt(await request('GET','/operations/'+encodeURIComponent(operationKey)),expected(input));}
   catch(e){if(e.code==='CENTRAL_NOT_FOUND')throw error('CENTRAL_OPERATION_UNRESOLVED');throw e;}
  },
  async read(invoiceId,input){
   if(!identifier(invoiceId))throw error('INVALID_INVOICE_ID');return assertReceipt(await request('GET','/invoices/'+encodeURIComponent(invoiceId)),expected(input));
  },
  async issue(invoiceId,input){
   const current=await this.read(invoiceId,input);
   if(current.state!=='prepared')return current;
   const key='issue:'+invoiceId;const fingerprint=await hash({scope,invoiceId});
   const reservation=await journal.reserve({scope,operation_key:key,fingerprint,phase:'issue'});
   if(!reservation||typeof reservation.created!=='boolean')throw error('JOURNAL_RESERVATION_INVALID');
   if(!reservation.created)return current;
   try{const result=assertReceipt(await request('POST','/invoices/'+encodeURIComponent(invoiceId)+'/issue',{}),expected(input));await journal.record({scope,operation_key:key,phase:'issue',state:'confirmed',invoice_id:invoiceId});return result;}
   catch(e){await journal.record({scope,operation_key:key,phase:'issue',state:'unknown',invoice_id:invoiceId});throw e;}
  },
  async reconcile(invoiceId,input){
   await this.read(invoiceId,input);return assertReceipt(await request('POST','/invoices/'+encodeURIComponent(invoiceId)+'/reconcile',{}),expected(input));
  },
  async voidUnsent(invoiceId,input){
   const current=await this.read(invoiceId,input);if(current.state!=='prepared'&&current.state!=='void')throw error('BANK_CANCELLATION_REQUIRED');
   return assertReceipt(await request('POST','/invoices/'+encodeURIComponent(invoiceId)+'/void',{}),expected(input));
  },
 });
}
