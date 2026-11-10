import {ultraPeriodStart} from '../reporting.mjs';
const MONEY=/^-?(0|[1-9]\d{0,17})(\.\d{1,8})?$/;
const UNIT=100000000n;
export function decimal8(value){if(typeof value!=='string'||!MONEY.test(value))throw Error('INVALID_MONEY');const neg=value.startsWith('-'),[a,b='']=value.replace('-','').split('.');return (neg?-1n:1n)*(BigInt(a)*UNIT+BigInt(b.padEnd(8,'0')));}
export function format8(value){const neg=value<0n;if(neg)value=-value;return (neg?'-':'')+String(value/UNIT)+'.'+String(value%UNIT).padStart(8,'0');}
export function validateClosedTrade(row){
 const keys=['id','symbol','market','currency','side','openedAt','closedAt','gross','fees','financing','complete','source'];
 if(!row||Object.keys(row).some(k=>!keys.includes(k))||typeof row.id!=='string'||!/^[-A-Za-z0-9_.:]{1,120}$/.test(row.id)||!/^[-A-Za-z0-9_./:!]{1,40}$/.test(row.symbol||'')||!['b3','crypto','forex'].includes(row.market)||!['BRL','USD','EUR','USDT'].includes(row.currency)||!['buy','sell'].includes(row.side)||row.complete!==true||row.source!=='broker')throw Error('INVALID_TRADE_RECEIPT');
 const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
 if(!iso(row.openedAt)||!iso(row.closedAt)||Date.parse(row.closedAt)<Date.parse(row.openedAt))throw Error('INVALID_TRADE_TIME');
 const gross=decimal8(row.gross),fees=decimal8(row.fees),financing=decimal8(row.financing);if(fees<0n)throw Error('NEGATIVE_FEES');
 return {...row,net:format8(gross-fees-financing)};
}
export function localResults(rows,{since=null,until=new Date().toISOString()}={}){
 if((since!==null&&!Number.isFinite(Date.parse(since)))||!Number.isFinite(Date.parse(until))||(since&&Date.parse(since)>Date.parse(until)))throw Error('INVALID_REPORT_PERIOD');
 const currencies=new Map(),ids=new Set(),operations=[];
 for(const input of rows){const row=validateClosedTrade(input);if(ids.has(row.id))throw Error('DUPLICATE_RECEIPT');ids.add(row.id);
  if((since&&Date.parse(row.closedAt)<Date.parse(since))||Date.parse(row.closedAt)>Date.parse(until))continue;
  const net=decimal8(row.net);const s=currencies.get(row.currency)||{currency:row.currency,operations:0,gains:0n,losses:0n,gross:0n,fees:0n,financing:0n,net:0n};
  s.operations++;s.gross+=decimal8(row.gross);s.fees+=decimal8(row.fees);s.financing+=decimal8(row.financing);s.net+=net;if(net>0n)s.gains+=net;else s.losses-=net;currencies.set(row.currency,s);operations.push(row);
 }
 return {totals:[...currencies.values()].map(s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,typeof v==='bigint'?format8(v):v]))),operations:operations.sort((a,b)=>Date.parse(b.closedAt)-Date.parse(a.closedAt))};
}
export function parseLocalReport(input){
 if(!input||Object.keys(input).some(k=>!['schema','environment','provider','connectionLabel','generatedAt','operations'].includes(k))||input.schema!=='JENIOS_ULTRA_LOCAL_REPORT_V1'||!['demo','live'].includes(input.environment)||!['profit','binance','mt5'].includes(input.provider)||typeof input.connectionLabel!=='string'||input.connectionLabel.length<1||input.connectionLabel.length>80||!Number.isFinite(Date.parse(input.generatedAt))||!Array.isArray(input.operations)||input.operations.length>20000)throw Error('INVALID_LOCAL_REPORT');
 const market={profit:'b3',binance:'crypto',mt5:'forex'}[input.provider],ids=new Set();
 const operations=input.operations.map(row=>{
  validateClosedTrade(row);
  if(row.market!==market||ids.has(row.id)||Date.parse(row.closedAt)>Date.parse(input.generatedAt))throw Error('INVALID_REPORT_RECEIPT');
  ids.add(row.id);return {...row};
 });
 return {...input,operations};
}
export function buildLocalDashboard(input,{period='30d',now=new Date(),page=0}={}){
 const report=parseLocalReport(input);
 if(!Number.isSafeInteger(page)||page<0)throw Error('INVALID_REPORT_PAGE');
 const selected=localResults(report.operations,{since:ultraPeriodStart(period,now),until:now.toISOString()});
 const lifetime=localResults(report.operations,{until:now.toISOString()});
 const groups=new Map();
 for(const row of selected.operations){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.closedAt));const key=day+row.currency;const group=groups.get(key)||{day,rows:[]};const {net,...original}=row;group.rows.push(original);groups.set(key,group);}
 const days=[...groups.values()].flatMap(g=>localResults(g.rows,{until:now.toISOString()}).totals.map(t=>({day:g.day,...t}))).sort((a,b)=>b.day.localeCompare(a.day));
 return {totals:selected.totals,lifetime:lifetime.totals,days,count:selected.operations.length,
  operations:selected.operations.slice(page*50,(page+1)*50).map(t=>({...t,closed_at:t.closedAt,opened_at:t.openedAt,gross_realized:t.gross,net_realized:t.net})),
  unrealized:null,environment:report.environment,connectionLabel:report.connectionLabel,source:'local_file',independentlyVerified:false};
}
export function reportCsv(input,{period='all',now=new Date()}={}){
 const report=parseLocalReport(input),rows=localResults(report.operations,{since:ultraPeriodStart(period,now),until:now.toISOString()}).operations;
 const cell=(v,column)=>{const raw=String(v),safe=column>=9&&MONEY.test(raw)?raw:raw.replace(/^[=+@-]/,"'$&");return '"'+safe.replaceAll('"','""')+'"';};
 const header=['Ambiente','Conexão','ID','Ativo','Mercado','Moeda','Direção','Abertura','Encerramento','Bruto','Taxas','Financiamento','Líquido'];
 return '\uFEFF'+[header,...rows.map(r=>[report.environment,report.connectionLabel,r.id,r.symbol,r.market,r.currency,r.side,r.openedAt,r.closedAt,r.gross,r.fees,r.financing,r.net])].map(row=>row.map(cell).join(';')).join('\r\n');
}
export function formatFinancialAmount(value,currency){
 // Preserve the eight decimal places received from the broker; no Number round-trip.
 const raw=String(value);if(!/^-?\d+(\.\d+)?$/.test(raw))return '—';
 const negative=raw.startsWith('-'),[whole,fraction='']=raw.replace('-','').split('.');
 const decimals=fraction.slice(0,8).replace(/0+$/,'').padEnd(2,'0');
 return (negative?'-':'')+whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+decimals+' '+currency;
}
