/** B78 — Auditable educational observations of SIMULATED INTENTIONS.
 * An intention is never a verified trade, P&L or clinical diagnosis.
 */
const modes=new Set(['manual','reversa','hibrida']);
export function observeSimulatedBehavior({initialDiagnostic=null,events=[],paused=false,selectedMode='manual'}={}){
 const mode=modes.has(selectedMode)?selectedMode:'manual';
 const raw=Array.isArray(events)?events.slice(0,100):[];
 const valid=raw.filter(e=>e&&e.executed===false&&e.source==='client_simulation'
  &&Number.isSafeInteger(e.timestamp)&&e.timestamp>0&&typeof e.ativo==='string'
  &&['COMPRA','VENDA'].includes(e.direcao));
 const times=valid.map(e=>e.timestamp).sort((a,b)=>a-b);
 let rapid=0;
 for(let i=1;i<times.length;i++)if(times[i]-times[i-1]<=30000)rapid++;
 const recent=valid.slice(0,10);
 const assets=new Set(recent.map(e=>e.ativo.toUpperCase()));
 const drift=initialDiagnostic?.verified===true&&
  ['manual','reversa'].includes(initialDiagnostic.mode)&&initialDiagnostic.mode!==mode;
 const notes=[];
 if(paused)notes.push('Pausa ativa nesta sessão: não registre novas intenções até retomar conscientemente.');
 if(rapid>=3)notes.push('Intenções registradas com intervalos curtos. Considere pausar e revisar seu plano.');
 if(recent.length>=5&&assets.size===1)notes.push('As últimas intenções concentram-se em um único ativo; revise a exposição planejada.');
 if(drift)notes.push('O modo selecionado difere da orientação inicial; registre o motivo da alteração.');
 if(!notes.length)notes.push('Registros fictícios disponíveis para revisão. Não há resultados financeiros verificados.');
 return Object.freeze({mode,paused:paused===true,intentions:valid.length,
  rapidSequences:rapid,trackedAssets:assets.size,diagnosticVerified:initialDiagnostic?.verified===true,
  initialMode:initialDiagnostic?.verified===true?initialDiagnostic.mode:null,
  notes,executedTrades:0,verifiedProfit:null,avoidedLoss:null,performanceInference:false});
}
