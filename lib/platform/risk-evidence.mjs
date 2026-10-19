/** Evidências de risco autenticadas. Nenhum cálculo inventa perda evitada. */
export const RISK_TABLE='jenios_platform_risk_events';
const MAX_ROWS=100;
const isValidId=id=>typeof id==='string'&&id.length>0&&id.length<100;
const validTime=s=>typeof s==='string'&&!Number.isNaN(Date.parse(s));

export function summarizeVerifiedRisk(rows) {
 const raw=Array.isArray(rows)?rows:[];
 const ids=new Set(),confirmed=[],paper=[];
 for(const row of raw.slice(0,MAX_ROWS)){
   if(!row||!isValidId(row.id)||ids.has(row.id)||!validTime(row.verified_at))continue;
   if(!['broker_confirmed','paper_confirmed'].includes(row.source))continue;
   if(!['risk_block','closed_trade'].includes(row.kind))continue;
   ids.add(row.id);
   if(row.source==='broker_confirmed')confirmed.push(row);
   else paper.push(row);
 }
 const blocked=confirmed.filter(r=>r.kind==='risk_block').length;
 const paperBlocked=paper.filter(r=>r.kind==='risk_block').length;
 const trades=confirmed.filter(r=>r.kind==='closed_trade' &&
   Number.isSafeInteger(r.realized_pnl_cents) &&
   Math.abs(r.realized_pnl_cents)<=1e14 && validTime(r.observed_at))
   .sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at))
   .slice(-20).map(r=>({verified:true,pnl:r.realized_pnl_cents/100,
     observedAt:r.observed_at}));
 return {
   verifiedBlocks:blocked,
   paperBlocks:paperBlocked,
   verifiedTrades:trades,
   avoidedLossBRL:null,
   avoidedLossStatus:'not_proven',
   evidenceStatus:confirmed.length>0?'broker_evidence':
     paper.length>0?'paper_only':'no_verified_records',
   message:'Bloqueios não demonstram quanto teria sido perdido sem a tecnologia.'
 };
}

export async function loadVerifiedRiskSummary(db,user){
 if(!user?.id || user.is_anonymous)throw Object.assign(new Error('Entre com sua conta.'),{status:401});
 const result=await db.from(RISK_TABLE)
   .select('id,kind,source,verified_at,observed_at,realized_pnl_cents')
   .eq('user_id',user.id)
   .order('observed_at',{ascending:false}).limit(MAX_ROWS);
 if(result.error)throw Object.assign(new Error('Evidências de risco ainda não estão disponíveis.'),{status:503});
 return summarizeVerifiedRisk(result.data);
}
