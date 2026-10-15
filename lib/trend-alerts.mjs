import {currentMarketRow} from './market-freshness.mjs';
export const ALERT_MODULES=Object.freeze({tokens:'Tendências de busca',megapulse:'MegaPulse',baleias:'Movimentações de baleias',novos:'Tokens Explosivos'});
export function trendAlertBatches(trends,radar,now=Date.now()){
 const batches=[];
 const add=(module,rows,key)=>batches.push({module,keys:[...new Set(rows.map(key).filter(x=>typeof x==='string'&&x.length<=200))].slice(0,100),title:'Novidades · '+ALERT_MODULES[module],body:module==='novos'?'Novos candidatos em observação no radar. Confira os dados e critérios no Hub.':'Há novos registros para acompanhar no Hub de Tendências.'});
 if(trends?.modulos?.tokens?.disponivel&&!trends.modulos.tokens.stale)add('tokens',trends.tokens||[],x=>x.id);
 if(trends?.modulos?.megapulse?.disponivel&&!trends.modulos.megapulse.stale)add('megapulse',(trends.megapulse||[]).filter(x=>currentMarketRow(x,now)),x=>x.id+':'+x.negociadoEm.slice(0,13));
 if(trends?.modulos?.baleias?.disponivel&&!trends.modulos.baleias.stale&&!trends.modulos.baleias.historico)add('baleias',trends.baleias||[],x=>x.id);
 if(radar?.disponivel)add('novos',radar.candidatos||[],x=>x.id);
 return batches;
}
export async function publishTrendAlerts(db,trends,radar,now){let sent=0;for(const batch of trendAlertBatches(trends,radar,now)){const {data,error}=await db.rpc('jenios_publish_trend_events',{p_module:batch.module,p_keys:batch.keys,p_title:batch.title,p_body:batch.body});if(error)throw Error('Falha ao registrar alertas.');sent+=Number(data)||0;}return sent;}
