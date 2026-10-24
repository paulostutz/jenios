/** Presentation-only contracts. Authorization and all amounts are verified by the server. */
import {proQuotaSummary} from '../../lib/assistant/pro-quota-policy.mjs';
export const PRO_UI_TASKS=Object.freeze([
 {id:'advanced_question',label:'Pergunta avançada',description:'Aprofunde uma dúvida e compare conceitos e cenários.',acceptsImage:false,requiresCurrentData:false},
 {id:'university_tutor',label:'Tutor da Universidade',description:'Peça uma explicação mais detalhada sobre o assunto que está estudando.',acceptsImage:false,requiresCurrentData:false},
 {id:'chart_screenshot',label:'Gráfico por imagem',description:'Interprete uma captura do gráfico, seus padrões e os limites da leitura.',acceptsImage:true,requiresCurrentData:false},
 {id:'market_moment',label:'Momento de um ativo',description:'Estude o ativo com os candles recentes e a fonte verificada pelo serviço.',acceptsImage:false,requiresCurrentData:true},
 {id:'opportunities',label:'Cenários sob observação',description:'Compare cenários e pontos de atenção do ativo selecionado.',acceptsImage:false,requiresCurrentData:true},
 {id:'manual_support',label:'Apoio à operação manual',description:'Organize hipóteses e riscos para a sua própria decisão.',acceptsImage:true,requiresCurrentData:true}
]);
export const PRO_PLAN_LABELS=Object.freeze({
 'platform-nacional':'Nacional · R$ 99,90/mês',
 'platform-global-crypto':'Cripto · R$ 149,90/mês',
 'platform-internacional-pro':'Global · R$ 199,90/mês'
});
export const PRO_TIMEFRAME_LABELS=Object.freeze({'1m':'1 minuto','5m':'5 minutos','15m':'15 minutos','1h':'1 hora','4h':'4 horas','1d':'1 dia'});
export function initialProTask(search=''){
 if(typeof search!=='string'||search.length>2048)return 'advanced_question';
 const tasks=new URLSearchParams(search).getAll('task');
 return tasks.length===1&&PRO_UI_TASKS.some(task=>task.id===tasks[0])?tasks[0]:'advanced_question';
}
const pendingStates=new Set(['reserved','dispatched','needs_reconciliation']);
export const unresolvedRequest=state=>pendingStates.has(state);
export function nanoAmount(value){
 if(typeof value==='string'&&!/^(0|[1-9]\d{0,15})$/.test(value))return null;
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const number=Number(value);
 return Number.isSafeInteger(number)&&number>=0?number:null;
}
export function formatNanoUsd(value){
 const amount=nanoAmount(value);if(amount===null)return 'Não disponível';
 const n=BigInt(amount),whole=(n/1_000_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 const fraction=(n%1_000_000_000n).toString().padStart(9,'0').replace(/0+$/,'').padEnd(2,'0');
 return 'US$\u00a0'+whole+','+fraction;
}
/** The provider equivalent can contain half a nanoUSD; preserve it exactly. */
export function formatProviderNanoUsd(value){
 if(typeof value!=='number'||!Number.isSafeInteger(value*2)||value<0)return 'Não disponível';
 const halves=BigInt(value*2),whole=(halves/2_000_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 const fraction=((halves%2_000_000_000n)*5n).toString().padStart(10,'0').replace(/0+$/,'').padEnd(2,'0');
 return 'US$\u00a0'+whole+','+fraction;
}
export function eligibleProSubscriber(data){
 return data?.proIncluded===true&&['platform-global-crypto','platform-internacional-pro'].includes(data.planCode);
}
export function insufficientProBalance(error){
 return ['INSUFFICIENT_BALANCE','INCLUDED_ALLOWANCE_EXHAUSTED'].includes(error?.proBody?.code||error?.code);
}
export function proConsumptionOptions(data,{source='included',insufficientBalance=false}={}){
 const eligible=eligibleProSubscriber(data),quota=proQuotaSummary(data?.allowance),wallet=verifiedWallet(data?.wallet);
 const transitionPending=data?.allowance?.status==='pending_transition';
 return {eligible,quota,wallet,transitionPending,
  showRecovery:eligible&&!transitionPending&&(quota.state==='near_limit'||quota.state==='exhausted'||insufficientBalance===true),
  includedInsufficient:eligible&&!transitionPending&&(quota.state==='exhausted'||source==='included'&&insufficientBalance===true),
  prepaidInsufficient:eligible&&!transitionPending&&source==='prepaid'&&insufficientBalance===true,
  canUsePrepaid:eligible&&Boolean(wallet&&wallet.available>0),
  canUpgrade:eligible&&data.planCode==='platform-global-crypto'};
}
export function proConsultationCopy(source){
 return source==='prepaid'?{
  title:'Consulta com adicional',
  description:'Esta consulta utilizará seu saldo adicional já confirmado. A franquia incluída no plano permanece separada.',
  consent:'com meu saldo adicional confirmado'
 }:{
  title:'Consulta incluída no plano',
  description:'Esta consulta utilizará a franquia disponível no seu plano ativo. Nenhuma compra adicional será aberta por esta confirmação.',
  consent:'com a franquia incluída no meu plano'
 };
}
export function proCreditActions({userId,eligible=false,offerReady=false,reconciliationEnabled=false,blocked=false}={}){
 const authenticated=typeof userId==='string'&&userId.length>0;
 return {canPurchase:authenticated&&eligible===true&&offerReady===true&&blocked!==true,
  canReconcile:authenticated&&reconciliationEnabled===true};
}
export function formatProDate(value){
 const time=typeof value==='string'?Date.parse(value):NaN;
 return Number.isFinite(time)?new Date(time).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Horário não disponível';
}
export function verifiedWallet(wallet){
 if(wallet?.status!=='verified')return null;
 const total=nanoAmount(wallet.totalNanoUsd),reserved=nanoAmount(wallet.reservedNanoUsd),available=nanoAmount(wallet.availableNanoUsd);
 if(total===null||reserved===null||available===null||total-reserved!==available)return null;
 return {total,reserved,available};
}
export function verifiedAllowance(allowance){
 if(allowance?.status!=='configured')return null;
 const total=nanoAmount(allowance.totalNanoUsd),spent=nanoAmount(allowance.spentNanoUsd),reserved=nanoAmount(allowance.reservedNanoUsd),available=nanoAmount(allowance.availableNanoUsd);
 if([total,spent,reserved,available].some(n=>n===null)||total-spent-reserved!==available)return null;
 return {total,spent,reserved,available};
}
export function taskAvailability(data,id){
 const task=PRO_UI_TASKS.find(t=>t.id===id);
 if(!task)return null;
 const server=Array.isArray(data?.tasks)?data.tasks.find(t=>t.id===id):null;
 return {...task,available:data?.paidGenerationEnabled===true&&server?.available===true,reason:typeof server?.reason==='string'?server.reason:''};
}
export function validQuote(quote,source,now=Date.now()){
 return Boolean(quote&&typeof quote.id==='string'&&quote.id.length>=16&&quote.id.length<=16384&&quote.source===source&&
  nanoAmount(quote.maxRetailNanoUsd)!==null&&nanoAmount(quote.maxRetailNanoUsd)>0&&Number.isFinite(Date.parse(quote.expiresAt))&&Date.parse(quote.expiresAt)>now);
}
export function requestStateLabel(state){
 return ({reserved:'Reserva confirmada',dispatched:'Em processamento',settled:'Concluída',released:'Reserva liberada',needs_reconciliation:'Consumo em conferência',not_started:'Não iniciada'})[state]||'Status a verificar';
}
export function fileProblem(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))return 'Escolha uma imagem PNG, JPEG ou WebP.';
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>3_000_000)return 'A imagem precisa ter até 3 MB.';
 return '';
}
export function canPrepareQuote({data,taskId,source,prompt,image,hasPending=false,locked=false}){
 const task=taskAvailability(data,taskId);
 if(locked||hasPending||!task?.available||typeof prompt!=='string'||!prompt.trim()||prompt.length>2500)return false;
 const balance=source==='included'?verifiedAllowance(data?.allowance):source==='prepaid'?verifiedWallet(data?.wallet):null;
 if(!balance||balance.available<=0)return false;
 if(taskId==='chart_screenshot'&&!image)return false;
 if(image&&!task.acceptsImage)return false;
 return true;
}
