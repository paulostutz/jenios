export const TREND_MODULES=[
 {id:'tokens',label:'Tendências de busca',icon:'↗'},
 {id:'megapulse',label:'MegaPulse B3 & Futuros',icon:'▥'},
 {id:'baleias',label:'Movimentações de baleias',icon:'◎'}
];
export function trendDetail(id,item){
 if(id==='megapulse')return `Pregão ${item.dataPregao} · ${Number(item.variacao).toLocaleString('pt-BR')}% · Fechamento ${Number(item.fechamento).toLocaleString('pt-BR')}`;
 if(id==='baleias')return `${Number(item.quantidade).toLocaleString('pt-BR',{maximumFractionDigits:4})} BTC · ${new Date(item.data).toLocaleString('pt-BR')}`;
 return item.rankingMercado?`Ranking de mercado #${item.rankingMercado}`:'Interesse nas buscas';
}
export function trendUrl(id,item){return id==='baleias'?item.url:id==='tokens'?'https://www.coingecko.com/en/coins/'+encodeURIComponent(item.id):null;}
