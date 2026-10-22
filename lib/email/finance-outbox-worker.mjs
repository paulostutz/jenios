/** B305 - Explicit, unscheduled worker. No dispatch on import or application requests.
 * Protected by QA-only opt in, a single allowlisted test recipient and a durable
 * Postgres outbox. Never invoke this from public routes or GET payment endpoints.
 */
import {paymentConfirmationEmail,financeEmailDispatchReadiness} from './finance-payment-confirmation.mjs';

const INTER_RECEIPT=/^E[A-Za-z0-9]{31}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(reason,retryable=false){
  return Object.assign(new Error(reason),{code:reason,retryable});
}
function confirmedBankRecord(row,order,payment){
  if (!row || !order || !payment) return false;
  return order.id===row.order_id && order.status==='paid' &&
    order.currency==='BRL' && order.provider==='inter_pix' &&
    order.amount_cents===row.amount_cents &&
    order.user_id===row.recipient_user_id &&
    payment.id===row.payment_id && payment.order_id===order.id &&
    payment.provider==='inter_pix' && payment.payment_method==='pix' &&
    payment.status==='confirmed' &&
    payment.amount_cents===row.amount_cents &&
    INTER_RECEIPT.test(payment.bank_end_to_end_id||'') &&
    payment.bank_end_to_end_id===row.bank_receipt_id &&
    Number.isFinite(Date.parse(payment.confirmed_at||'')) &&
    new Date(payment.confirmed_at).toISOString()===new Date(row.paid_at).toISOString();
}
async function one(db,table,id,columns){
  const {data,error}=await db.from(table).select(columns).eq('id',id).maybeSingle();
  if(error || !data)throw failure('FINANCE_REFERENCE_UNAVAILABLE');
  return data;
}
/** Server-only Resend HTTP adapter. Only called by runFinanceOutboxBatch with
 * allowlisted recipient and after verified bank/order row checks.
 */
export async function sendResendFinanceEmail(message,{apiKey,fetcher=fetch}={}){
  if(typeof apiKey!=='string'||!apiKey.startsWith('re_')||apiKey.length<14)
    throw failure('RESEND_SEND_NOT_CONFIGURED');
  if(typeof message?.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(message.idempotencyKey))
    throw failure('RESEND_IDEMPOTENCY_REQUIRED');
  let response;
  try {
    response=await fetcher('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        Authorization:'Bearer '+apiKey,
        'Content-Type':'application/json',
        'Idempotency-Key':message.idempotencyKey
      },
      body:JSON.stringify({from:message.from,to:[message.to],subject:message.subject,html:message.html,text:message.text})
    });
  }catch{
    // A network failure could mean provider accepted the message: quarantine.
    throw failure('RESEND_DELIVERY_UNCERTAIN');
  }
  if(!response?.ok){
    if(response?.status===429 || response?.status===409)
      throw failure('RESEND_RETRYABLE_'+response.status,true);
    throw failure('RESEND_UNCONFIRMED_HTTP_'+String(response?.status??0));
  }
  let data;try{data=await response.json()}catch{throw failure('RESEND_ACK_UNREADABLE')}
  if(typeof data?.id!=='string'||data.id.length<8||data.id.length>200)
    throw failure('RESEND_ACK_MISSING');
  return data.id;
}
export async function runFinanceOutboxBatch({db,env=process.env,fetcher,limit=3}={}){
  const readiness=financeEmailDispatchReadiness(env);
  const allowed=String(env?.JENIOS_EMAIL_TEST_RECIPIENT??'').trim().toLowerCase();
  // Mandatory QA allowlist. No production access; no background scheduler.
  if(!readiness.ready || !EMAIL.test(allowed))
    return Object.freeze({status:'DISABLED',claimed:0,sent:0,blocked:0});
  if(!db || typeof db.rpc!=='function')
    throw failure('FINANCE_DB_UNAVAILABLE');
  if(!Number.isSafeInteger(limit)||limit<1||limit>10)
    throw failure('FINANCE_BATCH_LIMIT_INVALID');
  const {data:rows,error}=await db.rpc('jenios_claim_pay_email_b305',{p_limit:limit});
  if(error || !Array.isArray(rows))throw failure('FINANCE_OUTBOX_CLAIM_FAILED');
  const result={status:'QA_ONLY',claimed:rows.length,sent:0,blocked:0};
  for(const row of rows){
    if(!row?.id || !row?.lease_token)throw failure('FINANCE_LEASE_INVALID');
    let sent=false,retryable=false,reason='FINANCE_REQUIRES_RECONCILIATION';
    try {
      if(String(row.recipient_email??'').trim().toLowerCase()!==allowed)
        throw failure('FINANCE_RECIPIENT_NOT_ALLOWED');
      const [order,payment]=await Promise.all([
        one(db,'jenios_pay_orders',row.order_id,'id,user_id,status,amount_cents,currency,provider'),
        one(db,'jenios_pay_payments',row.payment_id,'id,order_id,provider,payment_method,status,amount_cents,bank_end_to_end_id,confirmed_at')
      ]);
      if(!confirmedBankRecord(row,order,payment))
        throw failure('FINANCE_PAYMENT_NOT_VERIFIED');
      const message=paymentConfirmationEmail({
        orderId:row.order_id,status:order.status,bankVerified:true,
        receiptId:payment.bank_end_to_end_id,amountCents:row.amount_cents,
        currency:order.currency,paidAt:payment.confirmed_at,
        customerName:row.recipient_name,productName:row.product_name,
        to:allowed
      });
      const providerId=await sendResendFinanceEmail(message,{apiKey:env.RESEND_API_KEY,fetcher});
      const receipt=await db.rpc('jenios_complete_pay_email_b305',{
        p_id:row.id,p_lease:row.lease_token,p_provider_email_id:providerId
      });
      if(receipt.error || receipt.data!==true)
        throw failure('FINANCE_DELIVERY_LEDGER_UNCONFIRMED');
      sent=true;
      result.sent+=1;
    }catch(e){
      reason=/^FINANCE_|^RESEND_/.test(e?.code??'')?e.code:'FINANCE_SEND_BLOCKED';
      retryable=e?.retryable===true;
    }
    if(!sent){
      const release=await db.rpc('jenios_release_pay_email_b305',{
        p_id:row.id,p_lease:row.lease_token,p_error_code:reason,p_retryable:retryable
      });
      if(release.error || release.data!==true)
        throw failure('FINANCE_LEASE_RECONCILIATION_REQUIRED');
      result.blocked+=1;
    }
  }
  return Object.freeze(result);
}
