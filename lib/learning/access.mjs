import {requirePayToken,requirePayUser} from '../pay/auth.mjs';
import {learningError} from './engine.mjs';
import {isMasterAdmin} from '../admin-access.mjs';
import {claimVerifiedUniversityPass} from '../assistant/university-pass.mjs';
import {claimVerifiedMonthlyUniversity} from '../assistant/university-monthly-access.mjs';
import {verifiedPlatformPlan,proPlanAccess,verifiedUniversityPass,PLATFORM_PAID_TIERS} from '../assistant/pro-access.mjs';
/** Only subscriptions priced at R$ 149,90 and R$ 199,90 include the full University. */
export const LEARNING_PRODUCTS=PLATFORM_PAID_TIERS;
export async function requireLearner(request,db,now=Date.now(),env=process.env){
 requirePayToken(request);
 const user=await requirePayUser(request,db);
 if(isMasterAdmin(user,env))return {user,access:{kind:'admin-preview',productCode:null}};
 let plan,pass;
 try{plan=await verifiedPlatformPlan(db,user.id,now);}
 catch{throw learningError('Não foi possível verificar sua assinatura.',503,'SUBSCRIPTION_UNAVAILABLE');}
 const rights=proPlanAccess(plan,user,env);
 if(rights.universityIncluded)return {user,access:{kind:'subscription',productCode:plan.code,validUntil:plan.validUntil}};
 try{
  pass=await verifiedUniversityPass(db,user.id,now);
  if(!pass){
   const monthlyUpdated=await claimVerifiedMonthlyUniversity(db,user.id,now);
   const updated=monthlyUpdated||await claimVerifiedUniversityPass(db,user.id,now);
   if(updated)pass=await verifiedUniversityPass(db,user.id,now);
  }
 }catch{throw learningError('Não foi possível verificar o acesso avulso à Universidade.',503,'SUBSCRIPTION_UNAVAILABLE');}
 if(pass)return {user,access:{...pass,productCode:pass.productCode||'social-university-pass'}};
 throw learningError('A Universidade está incluída nos planos de R$ 149,90 e R$ 199,90. Para os demais acessos, contrate a Universidade separadamente por R$ 49,90 por mês.',402,'SUBSCRIPTION_REQUIRED');
}
