/** Same module selection, freshness and provenance as the official /tendencias Hub. */
import {TREND_MODULES,trendDetail,visibleTrendRows} from '../trends-ui.mjs';
export function dashboardHubModule(id,data,now=Date.now()){
 if(!TREND_MODULES.some(item=>item.id===id))throw TypeError('UNKNOWN_HUB_MODULE');
 const status=data?.modulos?.[id]||{};
 const usable=Boolean(status.disponivel||status.stale);
 const rows=usable?visibleTrendRows(id,data,now).slice(0,id==='baleias'?3:4):[];
 const defaultMessage=id==='megapulse'?'Sem cotações recentes confirmadas agora.':
  id==='baleias'?'Sem movimentações Bitcoin confirmadas na cobertura consultada.':
  'Nenhuma tendência de busca confirmada nesta atualização.';
 return {id,label:TREND_MODULES.find(item=>item.id===id).label,
  rows,historical:id==='baleias'&&status.historico===true,stale:status.stale===true,
  message:status.mensagem||defaultMessage,describe:row=>trendDetail(id,row)};
}
