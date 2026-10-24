/** B305: an audited, opt-in FINANCE email notification formatter.
 * Never sends for a pending order or unverified payment. Production requires its own explicit scope.
 * This module does NOT mutate any payment, subscription, order or bank state.
 */
import {createHash} from 'node:crypto';
import {JENIOS_FINANCE_SENDER,JENIOS_LOGO_URL,jeniosEmailShell,escapeEmailHtml} from './jenios-identity.mjs';
import {productionEmailDeliveryPolicy} from './production-delivery-policy.mjs';
import {emailDispatchLimits} from './dispatch-budget.mjs';
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
 const html=jeniosEmailShell({
  eyebrow:'Financeiro JENIOS',
  title:'Pagamento confirmado',
  lead:'Seu pagamento foi confirmado com segurança.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.65;margin:0 0 18px;color:#334155">Olá, <strong>'+safe.name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.65;margin:0 0 22px;color:#475569">Recebemos a confirmação do seu pagamento à JENIOS. Confira os dados abaixo:</p>'+
   '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">'+
   '<tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">Produto</td><td style="padding:12px 16px;text-align:right;color:#0f172a;font-size:13px;font-weight:700;border-bottom:1px solid #e2e8f0">'+safe.product+'</td></tr>'+
   '<tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">Valor</td><td style="padding:12px 16px;text-align:right;color:#10b981;font-size:15px;font-weight:800;border-bottom:1px solid #e2e8f0">'+safe.amount+'</td></tr>'+
   '<tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">Pedido</td><td style="padding:12px 16px;text-align:right;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0">'+safe.order+'</td></tr>'+
   '<tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0">Identificador bancário</td><td style="padding:12px 16px;text-align:right;color:#0f172a;font-size:12px;border-bottom:1px solid #e2e8f0">'+safe.receipt+'</td></tr>'+
   '<tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Confirmado em</td><td style="padding:12px 16px;text-align:right;color:#0f172a;font-size:12px">'+safe.date+'</td></tr></table>'+
   '<div style="margin-top:20px;padding:14px 16px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:10px;font-size:12px;line-height:1.55;color:#64748b">Esta mensagem confirma o pagamento. Ela não é comprovante fiscal e nunca solicitará senha, token, chave ou transferência.</div>'
 });
 const idempotencyKey=createHash('sha256').update('jenios:payment-confirmed:v1:'+orderId+':'+receiptId).digest('hex');
 return Object.freeze({from:JENIOS_FINANCE_SENDER,to,subject:'JENIOS | Pagamento confirmado',html,text,identityLogo:JENIOS_LOGO_URL,idempotencyKey});
}
export const B305_FINANCE_QA_BRANCH='fix/jenios-b305-finance-email-20261022';
export const B305_FINANCE_QA_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
export const B305_FINANCE_SOCIAL_QA_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
export const B305_FINANCE_EMAIL_DOMAIN='jenios.com.br';
/** QA retains its allowlisted recipient and separate test approval.
 * Production scope is opt-in and does not certify an external delivery.
 */
export function financeEmailDispatchReadiness(env={},now=Date.now()){
 const preview=env.VERCEL_ENV==='preview';
 const branch=env.VERCEL_GIT_COMMIT_REF===B305_FINANCE_QA_BRANCH;
 const project=env.JENIOS_B305_QA_PROJECT_ID===B305_FINANCE_QA_PROJECT &&
   env.VERCEL_PROJECT_ID===B305_FINANCE_QA_PROJECT;
 const socialIsolated=env.NEXT_PUBLIC_SUPABASE_URL===B305_FINANCE_SOCIAL_QA_URL;
 const flagsOff=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
   'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
   'JENIOS_PRIVATE_PAPER_EXECUTOR']
   .every(k=>env[k]==='false');
 const enabled=env.JENIOS_PAYMENT_EMAILS_ENABLED==='true';
 const testSendApproved=env.JENIOS_B305_TEST_SEND_APPROVED==='true';
 const sender=env.JENIOS_PAYMENT_EMAIL_FROM===JENIOS_FINANCE_SENDER;
 const hasApiKey=typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY);
 const domainExpected=env.JENIOS_RESEND_EXPECTED_DOMAIN===B305_FINANCE_EMAIL_DOMAIN;
 const domainVerified=domainExpected&&env.JENIOS_RESEND_DOMAIN_VERIFIED==='true';
 const isolated=preview&&branch&&project&&socialIsolated&&flagsOff&&env.JENIOS_EMAIL_PRODUCTION_ENABLED!=='true';
 const productionPolicy=productionEmailDeliveryPolicy(env);
 const mode=productionPolicy.ready?'production':isolated?'qa':null;
 const budgetReady=emailDispatchLimits(env,now).ready;
 const permitted=(productionPolicy.ready&&budgetReady)||(isolated&&testSendApproved);
 return Object.freeze({ready:permitted&&enabled&&sender&&hasApiKey&&domainVerified,
   mode,productionPolicy,budgetReady,
   isolated,preview,branch,project,sourceVerified:socialIsolated,
   financialOperationsDisabled:flagsOff,enabled,testSendApproved,
   senderVerified:sender,credentialsConfigured:hasApiKey,
   resendDomainExpected:domainExpected,resendDomainVerified:domainVerified,
   requiresIdempotentDeliveryLedger:true});
}
