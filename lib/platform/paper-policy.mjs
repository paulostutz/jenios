/** B80 — non-executable adapter for the three educational modes.
 * This module cannot place orders or write to brokerage, payments or robot cores.
 */
const MODES=Object.freeze(['direto','reverso','hibrido']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function assessPaperStrategy({mode='direto',balance,allocation,dailyStop,paused=false,analysis=null,observations=null}={}){
 const reasons=[];
 if(!MODES.includes(mode))reasons.push('Modo de estudo desconhecido.');
 if(!finite(balance)||balance<=0||balance>100000000)reasons.push('Saldo virtual inválido.');
 if(!finite(allocation)||allocation<=0||!finite(balance)||allocation>balance*0.25)
  reasons.push('Neste laboratório, limite a alocação fictícia a 25% do saldo.');
 if(!finite(dailyStop)||dailyStop<=0||!finite(balance)||dailyStop>balance*0.02)
  reasons.push('Neste laboratório, o limite diário fictício máximo é 2% do saldo.');
 if(paused===true)reasons.push('Antifúria ativo: sessão pausada.');
 if(observations?.rapidSequences>=3)reasons.push('Sequência rápida de intenções: reavalie seu ritmo.');
 if(!analysis||analysis.providerVerified!==true||analysis.live!==true)
  reasons.push('Sem cotação intradiária verificada para orientar qualquer decisão ao vivo.');
 const playbook=mode==='reverso'?'Estudar hipóteses contrárias e condições de invalidação, sem inverter ordens automaticamente.':
   mode==='hibrido'?'Comparar hipóteses de tendência e reversão; registrar divergências sem executar.':
   'Anotar tendência, suporte, resistência e plano de risco antes de uma decisão humana.';
 return Object.freeze({mode:MODES.includes(mode)?mode:null,
  rehearsalAllowed:reasons.filter(x=>!x.startsWith('Sem cotação')).length===0,
  realExecutionAllowed:false,brokerOrder:null,verifiedProfit:null,avoidedLoss:null,
  reasons,playbook,educational:true,source:'paper_scenario_only'});
}
export function simulationModeLabels(){
 return [{code:'direto',label:'Direto · estudo de tendência'},
  {code:'reverso',label:'Reverso · estudo de hipóteses contrárias'},
  {code:'hibrido',label:'Híbrido · comparação de cenários'}];
}
