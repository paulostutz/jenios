import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {loadTrends} from '../../../../lib/trends-service.mjs';
import {getNewTokenRadar} from '../../../../lib/newTokenRadar.mjs';
import {publishTrendAlerts} from '../../../../lib/trend-alerts.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=45;
export async function POST(request){const headers={'Cache-Control':'no-store'};try{
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return Response.json({error:'Unauthorized'},{status:401,headers});
 const db=getJeniosPayAdmin(),claim=await db.rpc('jenios_claim_trend_job',{p_token:token});
 if(claim.error||claim.data!==true)return Response.json({error:'Unauthorized or already running'},{status:403,headers});
 const subscribers=await db.from('jenios_trend_subscriptions').select('user_id',{count:'exact',head:true});if(subscribers.error)throw subscribers.error;if(!subscribers.count)return Response.json({ok:true,sent:0},{headers});
 const [trends,radar]=await Promise.all([loadTrends(db),getNewTokenRadar()]);const sent=await publishTrendAlerts(db,trends,radar);
 return Response.json({ok:true,sent},{headers});
 }catch{return Response.json({error:'Atualização indisponível.'},{status:503,headers});}}
