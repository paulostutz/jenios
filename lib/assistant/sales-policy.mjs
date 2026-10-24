/** Shared factual sales policy, reused from B282/B284. Prices are catalog facts;
 * checkout, entitlement and payment availability remain server decisions. */
import {helpFor,normalizeSupportText} from './knowledge.mjs';
import {commercialConcern} from './commercial-guidance.mjs';

export const SALES_PLANS=Object.freeze([
 Object.freeze({code:'platform-nacional',name:'Nacional — B3',priceCents:9990,advanced:false,
  summary:'Plano mensal de acesso à Platform Nacional, sujeito à disponibilidade do checkout e integração homologada.'}),
 Object.freeze({code:'platform-global-crypto',name:'Global Crypto — B3 e Cripto',priceCents:14990,advanced:true,
  summary:'Plano mensal B3 e cripto, com elegibilidade para Gênio/Gênia avançados quando o serviço estiver habilitado.'}),
 Object.freeze({code:'platform-internacional-pro',name:'Internacional Pro',priceCents:19990,advanced:true,
  summary:'Plano mensal para mercados globais elegíveis, com atendimento avançado quando houver dados e serviço homologados.'})
]);
export const SALES_ALLOWED_TOPICS=Object.freeze(['plataforma','social','universidade','assinatura','planos','precos','contratacao','funcionalidades','corretoras','privacidade','cadastro','pagamentos','suporte','trilhas']);
export const SALES_PATHS=Object.freeze({lp:'/lp',plans:'/checkout',social:'/social',university:'/platform/aprender',support:'/platform/assistente'});
export const SALES_MODEL_SPEND_MICRO_USD=20_000;

/** Server configuration only. An omitted mode preserves the capped B282
 * contract. Uncapped operation still needs the explicit G44 database policy;
 * this projection never authorizes a provider request by itself. */
export function salesMonthlyBudgetPolicy(env={}){
 const mode=env.JENIOS_AI_MONTHLY_BUDGET_MODE??'capped';
 if(mode==='uncapped')return Object.freeze({mode,limitMicroUsd:null});
 if(mode!=='capped')return null;
 const usd=Number(env.JENIOS_AI_MONTHLY_BUDGET_USD);
 if(!Number.isFinite(usd)||usd<1||usd>1000)return null;
 const limitMicroUsd=Math.floor(usd*1_000_000);
 return Number.isSafeInteger(limitMicroUsd)?Object.freeze({mode,limitMicroUsd}):null;
}
const aliases=[/\b(?:99[,.]90|nacional|somente b3)\b/g,/\b(?:149[,.]90|global crypto|global cripto)\b|\bb3\s+(?:e\s+)?cripto\b/g,/\b(?:199[,.]90|internacional(?: pro)?|pro global)\b/g];
const folded=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function commercialPlans(input,{includeNegated=false}={}){
 if(typeof input!=='string')return [];
 const value=folded(input),found=[];
 for(let index=0;index<SALES_PLANS.length;index++){
  aliases[index].lastIndex=0;
  for(const match of value.matchAll(aliases[index])){
   const clause=value.slice(0,match.index).split(/[;!?\n]|,\s+|\b(?:mas|e sim|porem)\b/).at(-1).slice(-90);
   const denied=/\b(?:nao (?:quero|desejo|era|e|escolhi|pretendo)|sem|exclua|exceto)\b.{0,65}$/.test(clause);
   if(includeNegated||!denied){found.push({plan:SALES_PLANS[index],position:match.index});break;}
  }
 }
 return found.sort((a,b)=>a.position-b.position).map(x=>x.plan);
}
export function commercialPlan(input){const plans=commercialPlans(input);return plans.length===1?plans[0]:null;}
export const isAdvancedTier=code=>SALES_PLANS.some(p=>p.code===code&&p.advanced);
export const planPrice=plan=>'R$ '+(plan.priceCents/100).toFixed(2).replace('.',',');
export function plansExplanation(plans,{comparison=false,message=''}={}){
 const list=plans.length?plans:SALES_PLANS;
 const paragraphs=list.map(p=>p.name+': '+planPrice(p)+' por mês. '+p.summary);
 const normalized=normalizeSupportText(message);
 if(list.length>1&&/mais barato|menor preco|mais economico/.test(normalized)){
  const lowest=[...list].sort((a,b)=>a.priceCents-b.priceCents)[0];
  paragraphs.unshift('Entre esses planos, o menor preço mensal é o do '+lowest.name+': '+planPrice(lowest)+'.');
 }else if(list.length>1&&/mais caro|maior preco/.test(normalized)){
  const highest=[...list].sort((a,b)=>b.priceCents-a.priceCents)[0];
  paragraphs.unshift('Entre esses planos, o maior preço mensal é o do '+highest.name+': '+planPrice(highest)+'.');
 }else if(comparison&&list.length>1)paragraphs.unshift('Comparando os planos que você mencionou:');
 paragraphs.push('Confira a disponibilidade e os termos atuais no checkout oficial. A conversa não cria cobrança, confirma pagamento ou libera ordens. Não há garantia de lucro.');
 return paragraphs.join('\n\n');
}
export function salesReplyGuided(message,persona='genio',{articles=helpFor(message),planCodes=null,comparison=false}={}){
 const plans=Array.isArray(planCodes)?planCodes.map(code=>SALES_PLANS.find(p=>p.code===code)).filter(Boolean):commercialPlans(message);
 const name=persona==='genia'?'Gênia':'Gênio';
 const supportOnly=articles.some(a=>['subscription-cancel','payments-pix','account-login','execution','security'].includes(a.id));
 const sales=!supportOnly&&(articles.some(a=>a.id==='plans')||plans.length>0);
 const concern=sales?commercialConcern(message):null;
 const quiet=['decline','hardship'].includes(concern);
 let explanation=sales?plansExplanation(plans,{comparison,message}):articles.length?articles.map(a=>a.text).join('\n\n'):
  'Ainda não tenho uma resposta verificada para essa pergunta. Você quer ajuda para entrar na conta, usar a Social, estudar na Universidade ou conhecer um plano?';
 if(concern==='decline')explanation='Tudo bem. Vou encerrar a oferta por aqui. Você pode retomar quando quiser.';
 else if(concern==='hardship')explanation='A assinatura não é um caminho para recuperar perdas ou pagar dívidas. Preserve o dinheiro das despesas essenciais e evite assumir uma nova mensalidade nesse momento. Não há garantia de resultado financeiro.';
 else if(concern==='price')explanation='Faz sentido avaliar se a mensalidade cabe na sua rotina e no seu orçamento. O valor deve se justificar pelos recursos que você realmente pretende usar, sem contar com ganhos no mercado.\n\n'+explanation+'\n\nVocê procura acesso à B3, também a cripto ou apenas estudo na Universidade?';
 else if(concern==='time')explanation='Com pouco tempo, uma rotina pequena pode ajudar a avaliar a utilidade: por exemplo, reservar dez minutos para estudar um conceito e registrar uma observação. Isso é uma sugestão de rotina, sem promessa de resultado. A JENIOS reúne estudo, gráficos e simulação; assinar só faz sentido se você conseguir usar o que contratar.\n\nSeu foco hoje é aprender ou organizar a análise que já faz?';
 else if(concern==='trust')explanation='Você pode avaliar o que está disponível antes de decidir: confira o gráfico, as fontes e datas do Hub e os termos do plano. Simulação usa valores fictícios; a sala não envia ordens reais nesta versão. Não vou usar resultados de terceiros ou promessas de lucro como prova.\n\nO que você precisa conferir para decidir: funcionamento, acesso ou condições da assinatura?';
 else if(concern==='complexity')explanation='Você pode começar por uma tarefa de cada vez: localizar um ativo, observar o gráfico e praticar com saldo fictício. A Universidade organiza o estudo por nivelamento e trilhas; contratar uma Platform completa não é obrigatório para estudar.\n\nO que mais dificulta seu começo: entender os conceitos ou usar as ferramentas?';
 else if(sales&&!comparison&&!/quanto|custa|preco|valor|contratar|assinar|comprar/.test(normalizeSupportText(message)))explanation+='\n\nO que você quer melhorar primeiro: seu estudo, a leitura dos gráficos ou o registro das simulações?';
 const links=sales&&!quiet?[{title:'Conferir planos e disponibilidade',href:'/checkout'}]:[];
 if(!quiet)for(const article of articles)if(!links.some(x=>x.href===article.href))links.push({title:article.title,href:article.href});
 return {name,explanation,planCode:sales&&!quiet&&plans.length===1?plans[0].code:null,links:links.slice(0,6),commercialPaused:quiet};
}
export function salesCanDiscuss(message){
 // Mentioning a password recovery or the absence of a guarantee is legitimate.
 // Actual credentials are rejected by the shared secret detector before inference.
 return typeof message==='string'&&!/\bcpf\s*[:=]\s*\d[\d. -]{9,}|\b(?:frase[ -]semente|chave privada|senha)\s*[:=]\s*\S{6,}/i.test(message);
}
