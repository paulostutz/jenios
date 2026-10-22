/** B305-R13 — Subscription dunning policy and branded finance notices.
 * Pure policy/formatter. No DB writes or network calls.
 */
import {createHash} from 'node:crypto';
import {JENIOS_FINANCE_SENDER,JENIOS_LOGO_URL,jeniosEmailShell,escapeEmailHtml} from './jenios-identity.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENTS=new Set(['due_soon_3d','due_today','past_due_1d','cancelled_7d']);
const DAY=24*60*60*1000;

export function subscriptionDunningStage({dueAt,paid=false,cancelled=false,now=Date.now()}={}){
 const due=Date.parse(dueAt||'');
 const current=typeof now==='number'?now:Date.parse(now||'');
 if(!Number.isFinite(due)||!Number.isFinite(current)) return 'invalid';
 if(paid) return 'paid';
 if(cancelled) return 'cancelled';
 const delta=current-due;
 if(delta>=7*DAY) return 'cancelled_7d';
 if(delta>=DAY) return 'past_due_1d';
 if(delta>=0) return 'due_today';
 if(delta>=-3*DAY) return 'due_soon_3d';
 return 'not_due';
}

export function subscriptionDunningEmail({eventKind,subscriptionId,productName,dueAt,to,customerName='Cliente JENIOS'}){
 if(!EVENTS.has(eventKind)||!subscriptionId||!productName||!Number.isFinite(Date.parse(dueAt||''))||!EMAIL.test(String(to||'')))
  throw Object.assign(Error('DUNNING_EMAIL_INVALID'),{code:'DUNNING_EMAIL_INVALID'});
 const safe={name:escapeEmailHtml(customerName),product:escapeEmailHtml(productName),due:escapeEmailHtml(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(dueAt)))};
 const copy={
  due_soon_3d:{subject:'JENIOS | Seu plano vence em 3 dias',title:'Seu plano vence em 3 dias',lead:'Um lembrete para você manter seu acesso sem interrupções.',body:'O vencimento do plano <strong>'+safe.product+'</strong> está previsto para <strong>'+safe.due+'</strong>. Regularize até a data para manter o acesso normalmente.'},
  due_today:{subject:'JENIOS | Seu plano vence hoje',title:'Seu plano vence hoje',lead:'Seu acesso continua ativo hoje, mas a renovação precisa ser confirmada.',body:'O plano <strong>'+safe.product+'</strong> vence hoje, <strong>'+safe.due+'</strong>. Assim que o pagamento for confirmado e conciliado, a renovação seguirá normalmente.'},
  past_due_1d:{subject:'JENIOS | Pagamento em atraso — prazo de regularização',title:'Pagamento em atraso',lead:'Você ainda pode regularizar o plano antes do cancelamento automático.',body:'O pagamento do plano <strong>'+safe.product+'</strong> está em atraso. Se não houver confirmação do pagamento, este plano será cancelado automaticamente ao completar <strong>7 dias corridos após o vencimento</strong>. O cancelamento afeta somente este plano específico.'},
  cancelled_7d:{subject:'JENIOS | Plano cancelado por falta de pagamento',title:'Plano cancelado',lead:'O prazo de 7 dias corridos para regularização foi encerrado.',body:'Como não houve confirmação do pagamento dentro do prazo, o plano <strong>'+safe.product+'</strong> foi cancelado automaticamente. O acesso aos recursos vinculados a este plano foi encerrado; sua conta JENIOS e outros produtos não são afetados.'}
 }[eventKind];
 const html=jeniosEmailShell({eyebrow:'Financeiro JENIOS',title:copy.title,lead:copy.lead,department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.65;margin:0 0 18px;color:#334155">Olá, <strong>'+safe.name+'</strong>.</p>'+
   '<div style="font-size:14px;line-height:1.7;color:#475569">'+copy.body+'</div>'+
   '<div style="margin-top:20px;padding:14px 16px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:10px;font-size:12px;line-height:1.55;color:#64748b">Se o pagamento já foi realizado, nenhuma ação adicional será tomada após a confirmação e conciliação. A JENIOS nunca solicita senha, token ou transferência por e-mail.</div>'});
 const text=['Olá, '+customerName+'.',copy.title,copy.body.replace(/<[^>]+>/g,''),'Financeiro | JENIOS','jenios.com.br'].join('\n');
 const idempotencyKey=createHash('sha256').update('jenios:subscription-dunning:v1:'+subscriptionId+':'+eventKind+':'+dueAt).digest('hex');
 return Object.freeze({from:JENIOS_FINANCE_SENDER,to,subject:copy.subject,html,text,identityLogo:JENIOS_LOGO_URL,idempotencyKey,eventKind});
}
