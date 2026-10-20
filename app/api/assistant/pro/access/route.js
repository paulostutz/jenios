import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayUser,requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {verifiedPlatformPlan,proPlanAccess} from '../../../../../lib/assistant/pro-access.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 try{
  requirePayToken(request);
  const db=getJeniosPayAdmin();
  const user=await requirePayUser(request,db);
  const plan=await verifiedPlatformPlan(db,user.id);
  const rights=proPlanAccess(plan,user);
  // The SQL wallet is private and may not be provisioned in this environment.
  // Missing infrastructure is NOT interpreted as purchased credits or a free grant.
  let wallet={availableMicroUsd:null,status:'not_provisioned'};
  try{
   const {data,error}=await db.from('jenios_pro_wallets')
    .select('paid_retail_micro_usd,reserved_retail_micro_usd')
    .eq('user_id',user.id).maybeSingle();
   if(!error){
    const paid=Number(data?.paid_retail_micro_usd||0),reserved=Number(data?.reserved_retail_micro_usd||0);
    if(Number.isSafeInteger(paid)&&Number.isSafeInteger(reserved)&&paid>=reserved&&reserved>=0)
     wallet={availableMicroUsd:paid-reserved,status:'verified'};
   }
  }catch{}
  return Response.json({ok:true,freeAvailable:true,proIncluded:rights.proIncluded,universityIncluded:rights.universityIncluded,
   planCode:rights.planCode||null,monthlyAllowanceMicroUsd:rights.allowanceMicroUsd,
   allowancePeriodEnd:rights.periodEnd,masterPreview:rights.master===true,wallet,
   paidGenerationEnabled:false,paymentStatus:'not_enabled',
   terms:'A franquia não autoriza consumo ilimitado. Comprar créditos exige pagamento confirmado.'},{headers});
 }catch(e){
  return Response.json({ok:false,error:e.status?e.message:'Não foi possível verificar seu plano.'},{status:e.status||503,headers});
 }
}
