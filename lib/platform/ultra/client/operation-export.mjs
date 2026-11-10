import {validateOperation,operationNet} from '../operation.mjs';
import {ultraPeriodStart} from '../reporting.mjs';
export function operationsCsv(operations,{period='all',now=new Date(),environment,connectionLabel}={}){
 const since=ultraPeriodStart(period,now),until=now.getTime(),ids=new Set();
 const records=operations.map(o=>{const r=validateOperation(o,{now:until});if(ids.has(r.id))throw Error('DUPLICATE_OPERATION');ids.add(r.id);return r;}).filter(o=>{const at=Date.parse(o.closedAt||o.createdAt);return at<=until&&(!since||at>=Date.parse(since));});
 const header=['Ambiente','Conexão','ID','Ativo','Mercado','Moeda','Direção','Estado','Criada','Abertura','Encerramento','Quantidade solicitada','Quantidade executada','Quantidade encerrada','Preço entrada','Preço saída','Bruto','Taxas / rebates','Financiamento','Em aberto','Líquido','Custos completos'];
 const cell=(v,i)=>{const s=v===null?'':String(v);const safe=i>=11&&i<=20&&/^-?\d+(\.\d+)?$/.test(s)?s:s.replace(/^[=+@-]/,"'$&");return '"'+safe.replaceAll('"','""')+'"';};
 return '\uFEFF'+[header,...records.map(o=>[environment,connectionLabel,o.id,o.symbol,o.market,o.currency,o.side,o.state,o.createdAt,o.openedAt,o.closedAt,o.requestedQuantity,o.entryQuantity,o.exitQuantity,o.entryPrice,o.exitPrice,o.gross,o.fees,o.financing,o.unrealized,operationNet(o),o.costsComplete?'Sim':'Não'])].map(row=>row.map(cell).join(';')).join('\r\n');
}
