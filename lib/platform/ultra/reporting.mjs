export const ULTRA_PERIODS=Object.freeze([{id:'today',label:'Hoje'},{id:'7d',label:'7 dias'},{id:'30d',label:'30 dias'},{id:'90d',label:'90 dias'},{id:'all',label:'Todo o período'}]);
export function ultraPeriodStart(period,now=new Date()){
 if(!ULTRA_PERIODS.some(x=>x.id===period)||!Number.isFinite(now.getTime()))throw Error('ULTRA_INVALID_PERIOD');
 if(period==='all')return null;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const start=new Date(date+'T00:00:00-03:00');
 if(period!=='today')start.setUTCDate(start.getUTCDate()-(Number(period.slice(0,-1))-1));
 return start.toISOString();
}
