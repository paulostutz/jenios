import {decimal8,format8} from './client/reporting.mjs';
export const OPERATION_STATES=Object.freeze({queued:'Preparada',sending:'Enviada',unknown:'Conferindo execução',open:'Em aberto',partially_closed:'Encerramento parcial',closed:'Encerrada',cancelled:'Cancelada',rejected:'Recusada'});
const keys=['id','revision','market','symbol','currency','side','state','createdAt','updatedAt','openedAt','closedAt','requestedQuantity','entryQuantity','exitQuantity','entryPrice','exitPrice','gross','fees','financing','unrealized','costsComplete','brokerRefs','reason'];
const decimal=/^(0|[1-9]\d{0,17})(\.\d{1,12})?$/;
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export function units12(v){if(typeof v!=='string'||!decimal.test(v))throw Error('INVALID_OPERATION_QUANTITY');const [a,b='']=v.split('.');return BigInt(a)*1000000000000n+BigInt(b.padEnd(12,'0'));}
export function validateOperation(value,{market=null,now=Date.now()}={}){
 const fail=()=>{throw Error('INVALID_OPERATION');};
 if(!value||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))fail();
 const o=Object.fromEntries(keys.map(k=>[k,value[k]]));
 if(typeof o.id!=='string'||!/^[-A-Za-z0-9_.:]{1,120}$/.test(o.id)||!Number.isSafeInteger(o.revision)||o.revision<1||!['b3','crypto','forex'].includes(o.market)||(market&&market!==o.market)||typeof o.symbol!=='string'||!/^[-A-Za-z0-9_./:!]{1,40}$/.test(o.symbol)||!['BRL','USD','EUR','USDT'].includes(o.currency)||!['buy','sell'].includes(o.side)||!Object.hasOwn(OPERATION_STATES,o.state))fail();
 if(!iso(o.createdAt)||!iso(o.updatedAt)||Date.parse(o.updatedAt)<Date.parse(o.createdAt)||Date.parse(o.updatedAt)>now+300000)fail();
 if(o.openedAt!==null&&(!iso(o.openedAt)||Date.parse(o.openedAt)<Date.parse(o.createdAt)-300000||Date.parse(o.openedAt)>Date.parse(o.updatedAt)))fail();
 if(o.closedAt!==null&&(!iso(o.closedAt)||!o.openedAt||Date.parse(o.closedAt)<Date.parse(o.openedAt)||Date.parse(o.closedAt)>Date.parse(o.updatedAt)))fail();
 if(o.state!=='closed'&&o.closedAt!==null)fail();
 const requested=units12(o.requestedQuantity),entry=units12(o.entryQuantity),exit=units12(o.exitQuantity);
 if(requested<=0n||entry>requested||exit>entry)fail();
 for(const k of ['entryPrice','exitPrice'])if(o[k]!==null&&units12(o[k])<=0n)fail();
 if((entry>0n&&(!o.openedAt||o.entryPrice===null))||(exit>0n&&o.exitPrice===null))fail();
 if(['open','partially_closed','closed'].includes(o.state)&&entry===0n)fail();
 if(o.state==='open'&&(exit!==0n||o.closedAt!==null))fail();
 if(o.state==='partially_closed'&&(exit===0n||exit===entry||o.closedAt!==null))fail();
 if(o.state==='closed'&&(!o.closedAt||entry!==exit))fail();
 if(['cancelled','rejected','queued'].includes(o.state)&&entry!==0n)fail();
 for(const k of ['gross','fees','financing','unrealized'])if(o[k]!==null)decimal8(o[k]);
 if(typeof o.costsComplete!=='boolean'||(o.costsComplete&&['gross','fees','financing'].some(k=>o[k]===null)))fail();
 if(!Array.isArray(o.brokerRefs)||o.brokerRefs.length>30||o.brokerRefs.some(x=>typeof x!=='string'||!/^[-A-Za-z0-9_.:]{1,120}$/.test(x))||new Set(o.brokerRefs).size!==o.brokerRefs.length)fail();
 if(o.reason!==null&&(typeof o.reason!=='string'||!/^[_A-Z0-9]{1,80}$/.test(o.reason)))fail();
 return o;
}
export function operationNet(o){return o.state==='closed'&&o.costsComplete?format8(decimal8(o.gross)-decimal8(o.fees)-decimal8(o.financing)):null;}
export function initialOperation(request,id,now=Date.now()){
 const quantity=typeof request.quantity==='number'&&Number.isFinite(request.quantity)?request.quantity.toFixed(12).replace(/\.?0+$/,''):request.quantity;
 const time=new Date(now).toISOString();return validateOperation({id,revision:1,market:request.market,symbol:request.symbol,currency:request.currency,side:request.side,state:'queued',createdAt:time,updatedAt:time,openedAt:null,closedAt:null,requestedQuantity:quantity,entryQuantity:'0',exitQuantity:'0',entryPrice:null,exitPrice:null,gross:null,fees:null,financing:null,unrealized:null,costsComplete:false,brokerRefs:[],reason:null},{now});
}
