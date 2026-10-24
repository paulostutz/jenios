import {currentMarketRow} from './market-freshness.mjs';
export const TREND_MODULES=[
 {id:'tokens',label:'Tendências de busca',icon:'↗'},
 {id:'megapulse',label:'MegaPulse B3 & Futuros',icon:'▥'},
 {id:'baleias',label:'Movimentações de baleias',icon:'◎'}
];
// B127 retired search-interest tokens; all customer surfaces use this approved selection.
export const ACTIVE_TREND_MODULES=TREND_MODULES.filter(item=>item.id!=='tokens');
export function trendDetail(id,item){
 if(id==='megapulse')return `Cotação ${new Date(item.negociadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · R$ ${Number(item.preco).toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${Number(item.variacao).toLocaleString('pt-BR')}% no pregão`;
 if(id==='baleias')return `${Number(item.quantidade).toLocaleString('pt-BR',{maximumFractionDigits:4})} BTC · ${new Date(item.data).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`;
 return item.rankingMercado?`Ranking de mercado #${item.rankingMercado}`:'Interesse nas buscas';
}
export function trendUrl(id,item){return id==='baleias'?item.url:id==='tokens'?'https://www.coingecko.com/en/coins/'+encodeURIComponent(item.id):null;}

export function visibleTrendRows(id,data,now=Date.now()){const rows=Array.isArray(data?.[id])?data[id]:[];return id==='megapulse'?rows.filter(row=>currentMarketRow(row,now)):rows;}
