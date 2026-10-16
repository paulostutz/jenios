import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken,requirePayUser} from '../../../../lib/pay/auth.mjs';
import {ALERT_MODULES} from '../../../../lib/trend-alerts.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failure=e=>Response.json({error:e.status?e.message:'Não foi possível salvar seus alertas.'},{status:e.status||503,headers});
async function context(request){requirePayToken(request);const db=getJeniosPayAdmin();return {db,user:await requirePayUser(request,db)};}
export async function GET(request){try{const {db,user}=await context(request);const {data,error}=await db.from('jenios_trend_subscriptions').select('module').eq('user_id',user.id);if(error)throw error;return Response.json({modules:(data||[]).map(x=>x.module)},{headers});}catch(e){return failure(e);}}
export async function PUT(request){try{const {db,user}=await context(request),body=await request.json();
 if(!Object.hasOwn(ALERT_MODULES,body.module)||typeof body.enabled!=='boolean')throw Object.assign(Error('Alerta inválido.'),{status:400});
 const result=body.enabled?await db.from('jenios_trend_subscriptions').upsert({user_id:user.id,module:body.module},{onConflict:'user_id,module',ignoreDuplicates:true}):await db.from('jenios_trend_subscriptions').delete().eq('user_id',user.id).eq('module',body.module);
 if(result.error)throw result.error;return Response.json({ok:true,enabled:body.enabled},{headers});
 }catch(e){return failure(e);}}
