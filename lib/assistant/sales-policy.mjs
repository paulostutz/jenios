/** B282: one public sales/support policy for Social, Landing Page and Platform.
 * Models are optional, actual product availability is checked only at checkout.
 */
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
export const SALES_MODEL_SPEND_MICRO_USD=20_000; // maximum reserved budget, not a token sale or a provider price
export function commercialPlan(input){
 if(typeof input!=='string')return null;
 const value=input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/199[,.]90|internacional|pro global/.test(value))return SALES_PLANS[2];
 if(/149[,.]90|global crypto|b3.*cripto|cripto.*b3/.test(value))return SALES_PLANS[1];
 if(/99[,.]90|nacional|somente b3/.test(value))return SALES_PLANS[0];
 return null;
}
export function isAdvancedTier(code){return SALES_PLANS.some(p=>p.code===code&&p.advanced);}
export function salesReplyGuided(message,persona='genio'){
 const chosen=commercialPlan(message);
 const name=persona==='genia'?'Gênia':'Gênio';
 const explanation=chosen
 ?'O plano '+chosen.name+' custa R$ '+(chosen.priceCents/100).toFixed(2).replace('.',',')+' por mês. '+chosen.summary+' Confira a disponibilidade e os termos atuais no checkout. Não há garantia de lucro nem liberação automática de ordens.'
 :'Posso explicar o uso da JENIOS Social, da Platform, da Universidade e comparar os planos de R$ 99,90, R$ 149,90 e R$ 199,90. Escolha o que deseja conhecer; a contratação é feita somente pelo checkout oficial, após confirmação do pagamento.';
 return {name,explanation,planCode:chosen?.code||null,links:[{title:'Conhecer os planos',href:'/checkout'},{title:'Universidade JENIOS',href:'/platform/aprender'}]};
}
export function salesCanDiscuss(message){
 const normalized=String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return !/senha|frase.semente|chave privada|api.secret|token pessoal|cpf completo/.test(normalized);
}
