export const MEGAPULSE_MAX_AGE_MS=120000;
export function currentMarketRow(row,now=Date.now()){
 const at=Date.parse(row?.negociadoEm);
 return Number.isFinite(at)&&at<=now&&now-at<=MEGAPULSE_MAX_AGE_MS&&Number.isFinite(row.preco)&&row.preco>0&&Number.isFinite(row.variacao)&&row.variacao!==0;
}
