/** B305-R13 — JENIOS lifecycle and content marketing email templates.
 * Pure formatters/policy. No delivery, DB or scheduling side effects.
 */
import {createHash} from 'node:crypto';
import {JENIOS_LOGO_URL,JENIOS_FINANCE_SENDER,jeniosEmailShell,escapeEmailHtml} from './jenios-identity.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CTA_BASE='https://www.jenios.com.br';
const hash=(parts)=>createHash('sha256').update(parts.join(':')).digest('hex');
const clean=(v)=>escapeEmailHtml(String(v??'').trim());

export const JENIOS_EMAIL_CADENCE=Object.freeze({
 socialWelcome:'once',
 planActivated:'once_per_subscription_period',
 cartRecoveryHours:Object.freeze([2,24,72]),
 noPlanNurtureDays:Object.freeze([3,10]),
 newsletter:'weekly',
 onboardingStarted:'once_per_platform_activation',
 onboardingCompleted:'once_per_completed_onboarding'
});

function marketingFooter(unsubscribeUrl){
 const u=clean(unsubscribeUrl);
 return '<p style="font-size:11px;line-height:1.55;color:#94a3b8;margin:20px 0 0">Você está recebendo esta comunicação porque possui relacionamento com a JENIOS e está elegível para comunicações de conteúdo. <a href="'+u+'" style="color:#7c3aed">Gerenciar preferências ou sair desta lista</a>.</p>';
}
function baseMessage({kind,to,subject,title,lead,body,department='Relacionamento',idParts,unsubscribeUrl=null}){
 if(!EMAIL.test(String(to||'')))throw Object.assign(Error('LIFECYCLE_EMAIL_INVALID'),{code:'LIFECYCLE_EMAIL_INVALID'});
 const marketing=Boolean(unsubscribeUrl);
 const html=jeniosEmailShell({eyebrow:'JENIOS',title,lead,department,
  body:body+(marketing?marketingFooter(unsubscribeUrl):'')});
 return Object.freeze({
  from:kind.startsWith('plan_')?JENIOS_FINANCE_SENDER:'JENIOS <noreply@jenios.com.br>',
  to,subject,html,identityLogo:JENIOS_LOGO_URL,kind,
  idempotencyKey:hash(['jenios','email',kind,...idParts])
 });
}

export function socialWelcomeEmail({userId,to,customerName='Olá'}){
 const name=clean(customerName);
 return baseMessage({
  kind:'social_welcome',to,subject:'Bem-vindo à JENIOS Social',title:'Bem-vindo à JENIOS Social',
  lead:'Sua conta está pronta. Agora você já pode acompanhar o mercado, aprender e participar da comunidade.',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">Na JENIOS Social você pode acompanhar publicações, trocar experiências e acessar conteúdos de mercado. Se quiser avançar para ferramentas de operação e tecnologia adaptativa, os planos da JENIOS Platform ficam disponíveis separadamente.</p>'+
   '<p><a href="'+CTA_BASE+'/social" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Entrar na JENIOS Social</a></p>',
  idParts:[userId]
 });
}

export function planActivatedEmail({subscriptionId,to,customerName='Cliente JENIOS',planName}){
 const name=clean(customerName),plan=clean(planName);
 return baseMessage({
  kind:'plan_activated',to,subject:'JENIOS | Seu plano está ativo',title:'Seu plano está ativo',
  lead:'Pagamento confirmado e acesso liberado para o plano contratado.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">O plano <strong>'+plan+'</strong> está ativo. A partir de agora, você já pode utilizar os recursos vinculados a essa assinatura.</p>'+
   '<p><a href="'+CTA_BASE+'/dashboard" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Acessar minha conta</a></p>',
  idParts:[subscriptionId]
 });
}

export function cartRecoveryEmail({cartId,to,customerName='Cliente JENIOS',planName,step=1,unsubscribeUrl}){
 if(![1,2,3].includes(step))throw Object.assign(Error('CART_RECOVERY_STEP_INVALID'),{code:'CART_RECOVERY_STEP_INVALID'});
 const name=clean(customerName),plan=clean(planName);
 const copies=[
  ['Você deixou uma escolha pela metade','Seu carrinho ficou salvo','Você chegou até o plano <strong>'+plan+'</strong>, mas não concluiu. Se ainda fizer sentido para você, pode continuar de onde parou — sem pressa.'],
  ['Antes de decidir, veja o que você realmente leva','Mais contexto para uma decisão melhor','Mais importante do que simplesmente contratar é entender se o <strong>'+plan+'</strong> combina com sua forma de operar. A proposta da JENIOS é apoiar decisões com tecnologia, leitura de contexto e gestão de risco.'],
  ['Último lembrete sobre seu carrinho','Seu carrinho ainda está disponível','Este é o último lembrete automático sobre o <strong>'+plan+'</strong>. Se quiser continuar, seu acesso ao checkout permanece disponível. Depois disso, encerramos esta sequência para não ser inconveniente.']
 ][step-1];
 return baseMessage({
  kind:'cart_recovery_'+step,to,subject:'JENIOS | '+copies[0],title:copies[0],lead:copies[1],
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">'+copies[2]+'</p>'+
   '<p><a href="'+CTA_BASE+'/planos" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Ver meu plano</a></p>',
  idParts:[cartId,String(step)],unsubscribeUrl
 });
}

export function noPlanNurtureEmail({userId,to,customerName='Cliente JENIOS',step=1,unsubscribeUrl}){
 if(![1,2].includes(step))throw Object.assign(Error('NURTURE_STEP_INVALID'),{code:'NURTURE_STEP_INVALID'});
 const name=clean(customerName);
 const copies=[
  ['Operar mais não significa operar melhor','Tecnologia para transformar informação em decisão','A JENIOS Platform foi desenhada para ajudar o usuário a organizar contexto, risco e execução. Você pode conhecer os modos Manual, Híbrido e Reverso e entender qual abordagem faz mais sentido para o seu perfil.'],
  ['Quando a disciplina falha, a tecnologia pode ajudar','Conheça a lógica por trás da JENIOS Platform','Uma das propostas da JENIOS é reduzir decisões impulsivas e transformar padrões de operação em informação útil. O objetivo não é prometer resultado, e sim dar mais estrutura para decisões e controle de risco.']
 ][step-1];
 return baseMessage({
  kind:'no_plan_nurture_'+step,to,subject:'JENIOS | '+copies[0],title:copies[0],lead:copies[1],
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">'+copies[2]+'</p>'+
   '<p><a href="'+CTA_BASE+'/planos" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Conhecer os planos</a></p>',
  idParts:[userId,String(step)],unsubscribeUrl
 });
}

export function marketNewsletterEmail({editionId,to,customerName='Cliente JENIOS',items,unsubscribeUrl}){
 if(!Array.isArray(items)||items.length<1||items.length>5)throw Object.assign(Error('NEWSLETTER_ITEMS_INVALID'),{code:'NEWSLETTER_ITEMS_INVALID'});
 const name=clean(customerName);
 const cards=items.map((item,i)=>{
  if(!item?.title||!item?.summary||!item?.sourceName||!item?.sourceUrl)throw Object.assign(Error('NEWSLETTER_ITEM_INVALID'),{code:'NEWSLETTER_ITEM_INVALID'});
  const title=clean(item.title),summary=clean(item.summary),source=clean(item.sourceName),url=clean(item.sourceUrl);
  return '<div style="padding:16px 0;border-bottom:1px solid #e2e8f0"><div style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase">Destaque '+(i+1)+'</div><h3 style="font-size:17px;margin:6px 0;color:#0f172a">'+title+'</h3><p style="font-size:13px;line-height:1.65;color:#475569;margin:0 0 8px">'+summary+'</p><a href="'+url+'" style="font-size:12px;color:#7c3aed;text-decoration:none;font-weight:700">Fonte: '+source+'</a></div>';
 }).join('');
 return baseMessage({
  kind:'market_newsletter',to,subject:'JENIOS | Radar de Mercado',title:'Radar de Mercado',
  lead:'Uma seleção curta dos assuntos que merecem sua atenção nesta semana.',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+cards+
   '<p style="font-size:12px;line-height:1.6;color:#64748b;margin-top:18px">Conteúdo informativo. Não constitui recomendação de investimento.</p>',
  idParts:[editionId],unsubscribeUrl
 });
}


export function onboardingStartedEmail({userId,to,customerName='Cliente JENIOS',planName='JENIOS Platform'}){
 const name=clean(customerName),plan=clean(planName);
 return baseMessage({
  kind:'onboarding_started',to,subject:'JENIOS | Configure sua experiência',title:'Configure sua experiência',
  lead:'Vamos ajustar a JENIOS ao seu perfil e às suas preferências operacionais.',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">Seu acesso ao <strong>'+plan+'</strong> está pronto para a configuração inicial. O onboarding organiza preferências, horizonte operacional e parâmetros de risco para personalizar sua experiência.</p>'+
   '<p><a href="'+CTA_BASE+'/onboarding" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Iniciar configuração</a></p>',
  idParts:[userId,plan]
 });
}

export function onboardingCompletedEmail({userId,to,customerName='Cliente JENIOS'}){
 const name=clean(customerName);
 return baseMessage({
  kind:'onboarding_completed',to,subject:'JENIOS | Configuração inicial concluída',title:'Configuração inicial concluída',
  lead:'Suas preferências iniciais foram registradas e sua experiência está pronta para continuar.',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">A configuração inicial foi concluída. Você pode revisar suas preferências e controles de risco dentro da plataforma sempre que necessário.</p>'+
   '<p><a href="'+CTA_BASE+'/dashboard" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Acessar a JENIOS</a></p>',
  idParts:[userId]
 });
}


function lifecycleDate(value){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))throw Object.assign(Error('LIFECYCLE_DATE_INVALID'),{code:'LIFECYCLE_DATE_INVALID'});
 return clean(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',day:'2-digit',month:'2-digit',year:'numeric'}).format(date));
}

export function planCancellationScheduledEmail({subscriptionId,to,customerName='Cliente JENIOS',planName,effectiveAt}){
 const name=clean(customerName),plan=clean(planName),date=lifecycleDate(effectiveAt);
 return baseMessage({
  kind:'plan_cancel_scheduled',to,subject:'JENIOS | Cancelamento programado',title:'Cancelamento programado',
  lead:'Registramos sua solicitação de cancelamento para o fim do período atual.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">O plano <strong>'+plan+'</strong> permanecerá disponível até <strong>'+date+'</strong>. Depois dessa data, os recursos vinculados a esse plano serão encerrados.</p>'+
   '<p style="font-size:13px;line-height:1.65;color:#64748b">Sua conta JENIOS e outros produtos permanecem independentes deste cancelamento.</p>',
  idParts:[subscriptionId,effectiveAt]
 });
}

export function planCancelledEmail({subscriptionId,to,customerName='Cliente JENIOS',planName,effectiveAt}){
 const name=clean(customerName),plan=clean(planName),date=lifecycleDate(effectiveAt);
 return baseMessage({
  kind:'plan_cancelled',to,subject:'JENIOS | Seu plano foi cancelado',title:'Plano cancelado',
  lead:'O cancelamento programado foi concluído.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">O plano <strong>'+plan+'</strong> foi encerrado em <strong>'+date+'</strong>. Os recursos vinculados exclusivamente a esse plano não estão mais ativos.</p>'+
   '<p style="font-size:13px;line-height:1.65;color:#64748b">Sua conta JENIOS e outros produtos não são cancelados por esta ação.</p>',
  idParts:[subscriptionId,effectiveAt]
 });
}

export function planReactivatedEmail({subscriptionId,cycleKey,to,customerName='Cliente JENIOS',planName}){
 const name=clean(customerName),plan=clean(planName);
 return baseMessage({
  kind:'plan_reactivated',to,subject:'JENIOS | Seu plano foi reativado',title:'Plano reativado',
  lead:'A regularização foi confirmada e o acesso do plano voltou a ficar ativo.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">O plano <strong>'+plan+'</strong> está ativo novamente. A liberação só ocorre após a confirmação do pagamento e do direito de acesso correspondente.</p>'+
   '<p><a href="'+CTA_BASE+'/dashboard" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Acessar minha conta</a></p>',
  idParts:[subscriptionId,cycleKey]
 });
}

export function planChangedEmail({subscriptionId,changeKey,to,customerName='Cliente JENIOS',previousPlanName,planName}){
 const name=clean(customerName),previous=clean(previousPlanName),plan=clean(planName);
 return baseMessage({
  kind:'plan_changed',to,subject:'JENIOS | Seu plano foi atualizado',title:'Plano atualizado',
  lead:'A alteração da sua assinatura foi confirmada.',
  department:'Financeiro',
  body:'<p style="font-size:15px;line-height:1.7;color:#334155">Olá, <strong>'+name+'</strong>.</p>'+
   '<p style="font-size:14px;line-height:1.7;color:#475569">Sua assinatura foi alterada de <strong>'+previous+'</strong> para <strong>'+plan+'</strong>. O novo acesso só é confirmado quando pedido, pagamento e entitlement estão consistentes no servidor.</p>'+
   '<p><a href="'+CTA_BASE+'/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:800">Ver minha assinatura</a></p>',
  idParts:[subscriptionId,changeKey]
 });
}
