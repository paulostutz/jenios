import {currentPlatformSession} from './diagnostic-client.mjs';
export const NO_EVIDENCE=Object.freeze({
  verifiedBlocks:null,paperBlocks:null,verifiedTrades:[],avoidedLossBRL:null,
  avoidedLossStatus:'not_proven',evidenceStatus:'unavailable'
});
export async function loadAccountRisk(supabase,fetcher=fetch){
  const session=await currentPlatformSession(supabase);
  if(!session)return {...NO_EVIDENCE,userId:null,evidenceStatus:'authentication_required'};
  try{
    const response=await fetcher('/api/platform/risk-summary',{
      headers:{authorization:'Bearer '+session.access_token},cache:'no-store'
    });
    if(!response.ok)return {...NO_EVIDENCE,userId:session.user.id};
    const data=await response.json();
    const latest=await currentPlatformSession(supabase);
    if(!latest||latest.user.id!==session.user.id)return {...NO_EVIDENCE,userId:null};
    if(!['no_verified_records','paper_only','broker_evidence'].includes(data?.evidenceStatus)
      ||data.avoidedLossBRL!==null)return {...NO_EVIDENCE,userId:session.user.id};
    const blocks=Number(data.verifiedBlocks),paper=Number(data.paperBlocks);
    if(!Number.isSafeInteger(blocks)||blocks<0||blocks>100
      ||!Number.isSafeInteger(paper)||paper<0||paper>100)
      return {...NO_EVIDENCE,userId:session.user.id};
    const trades=Array.isArray(data.verifiedTrades)?data.verifiedTrades
      .filter(t=>t?.verified===true&&Number.isFinite(t.pnl)&&typeof t.observedAt==='string').slice(-20):[];
    return {userId:session.user.id,verifiedBlocks:blocks,paperBlocks:paper,
      verifiedTrades:trades,avoidedLossBRL:null,
      avoidedLossStatus:'not_proven',evidenceStatus:data.evidenceStatus};
  }catch{return {...NO_EVIDENCE,userId:session.user.id};}
}
