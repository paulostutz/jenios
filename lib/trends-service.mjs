import {getMegaPulse} from './megapulse.mjs';
import {getWhaleTransfers} from './whale-transfers.mjs';
import {createWhaleHistory} from './whale-history.mjs';
/** B127: load only the approved market movement modules. No search-trending provider calls. */
export async function loadTrends(db,{mega=getMegaPulse,whales=getWhaleTransfers,now=()=>new Date().toISOString()}={}){
 const [megaResult,whaleResult]=await Promise.all([
  mega(),whales({history:db?createWhaleHistory(db):undefined})
 ]);
 return {
  disponivel:Boolean(megaResult.status?.disponivel||whaleResult.status?.disponivel),
  atualizadoEm:now(), fonte:null,tokens:[],
  megapulse:megaResult.rows||[],baleias:whaleResult.rows||[],
  modulos:{
   tokens:{disponivel:false,mensagem:'Tendências de buscas não fazem parte do Hub JENIOS.'},
   megapulse:megaResult.status||{disponivel:false},
   baleias:whaleResult.status||{disponivel:false}
  }
 };
}
