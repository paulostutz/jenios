/** B305: an audited, opt-in FINANCE email notification formatter.
 * Never sends for a pending order, unverified payment, or in a production environment.
 * This module does NOT mutate any payment, subscription, order or bank state.
 */
import {createHash} from 'node:crypto';
import {JENIOS_FINANCE_SENDER,JENIOS_LOGO_URL,jeniosEmailSignature,escapeEmailHtml} from './jenios-identity.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function paymentConfirmationEmail({orderId,status,bankVerified,receiptId,amountCents,currency='BRL',paidAt,customerName,productName,to}){
 if(!UUID.test(orderId||'')||status!=='paid'||bankVerified!==true||
    !/^[A-Za-z0-9_-]{10,100}$/.test(receiptId||'')||
    !Number.isSafeInteger(amountCents)||amountCents<1||currency!=='BRL'||
    !Number.isFinite(Date.parse(paidAt||''))||typeof to!=='string'||!EMAIL.test(to)||
    !customerName||!productName)throw Object.assign(Error('PAYMENT_EMAIL_UNVERIFIED_OR_INCOMPLETE'),{code:'PAYMENT_EMAIL_UNVERIFIED_OR_INCOMPLETE'});
 const date=new Date(paidAt);
 const amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amountCents/100);
 const safe={name:escapeEmailHtml(customerName),product:escapeEmailHtml(productName),order:escapeEmailHtml(orderId),receipt:escapeEmailHtml(receiptId),amount:escapeEmailHtml(amount),date:escapeEmailHtml(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date))};
 const text=['Olá, '+String(customerName)+'.','Confirmamos seu pagamento à JENIOS.','Produto: '+productName,'Valor: '+amount,'Pedido: '+orderId,'Identificador bancário: '+receiptId,'Data da confirmação: '+safe.date,'Financeiro | JENIOS','jenios.com.br'].join('\n');
 const html='<div style="font-family:Arial,Helvetica,sans-serif;color:#202838;background:#fff;max-width:620px;margin:auto;padding:24px">'+
 '<h2 style="font-size:23px">Pagamento confirmado</h2><p>Olá, '+safe.name+'.</p><p>Recebemos a confirmação do seu pagamento à JENIOS.</p>'+
 '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px"><tr><td>Produto</td><td><strong>'+safe.product+'</strong></td></tr>'+
 '<tr><td>Valor</td><td><strong>'+safe.amount+'</strong></td></tr><tr><td>Pedido</td><td>'+safe.order+'</td></tr>'+
 '<tr><td>Identificador bancário</td><td>'+safe.receipt+'</td></tr><tr><td>Confirmado em</td><td>'+safe.date+'</td></tr></table>'+
 '<p style="font-size:12px;color:#64748b">Esta mensagem confirma o pagamento; não é comprovante fiscal e não solicita credenciais, chaves ou transferências.</p>'+
 jeniosEmailSignature({department:'Financeiro'})+'</div>';
 const idempotencyKey=createHash('sha256').update('jenios:payment-confirmed:v1:'+orderId+':'+receiptId).digest('hex');
 return Object.freeze({from:JENIOS_FINANCE_SENDER,to,subject:'JENIOS | Pagamento confirmado',html,text,identityLogo:JENIOS_LOGO_URL,idempotencyKey});
}
export function financeEmailDispatchReadiness(env=process.env){
 const preview=env.VERCEL_ENV==='preview';
 const enabled=env.JENIOS_PAYMENT_EMAILS_ENABLED==='true';
 const sender=env.JENIOS_PAYMENT_EMAIL_FROM===JENIOS_FINANCE_SENDER;
 const hasApiKey=typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY);
 return Object.freeze({ready:preview&&enabled&&sender&&hasApiKey,preview,enabled,senderVerified:sender,credentialsConfigured:hasApiKey,requiresIdempotentDeliveryLedger:true});
}
