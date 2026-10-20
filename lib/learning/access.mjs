import {requirePayToken,requirePayUser} from '../pay/auth.mjs';
import {learningError} from './engine.mjs';
import {isMasterAdmin} from '../admin-access.mjs';
export const LEARNING_PRODUCTS=Object.freeze(['platform-nacional','platform-global-crypto','platform-internacional-pro']);
export async function requireLearner(request,db,now=Date.now(),env=process.env){
 requirePayToken(request);const user=await requirePayUser(request,db);
 // An explicit server-approved Master can preview courses. Operational admins cannot.
 if(isMasterAdmin(user,env))return {user,access:{kind:'admin-preview',productCode:null}};
 const [subscriptions,products]=await Promise.all([
  db.from('jenios_pay_subscriptions').select('id,product_id,status,current_period_start,current_period_end,cancel_at_period_end').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
  db.from('jenios_pay_products').select('id,code,name,category').in('code',LEARNING_PRODUCTS).limit(10),
 ]);
 if(subscriptions.error||products.error)throw learningError('Não foi possível verificar sua assinatura.',503,'SUBSCRIPTION_UNAVAILABLE');
 const active=(subscriptions.data||[]).flatMap(row=>{
  const product=(products.data||[]).find(p=>p.id===row.product_id && p.category==='platform');
  if(!product)return [];
  const start=Date.parse(row.current_period_start),end=Date.parse(row.current_period_end);
  const valid=['active','trialing'].includes(row.status)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<end;
  return valid&&LEARNING_PRODUCTS.includes(product.code)?[{productCode:product.code,currentPeriodEnd:row.current_period_end,active:true}]:[];
 })[0];
 if(!active)throw learningError('O ambiente de ensino está incluído nos três planos. É necessária uma assinatura vigente.',402,'SUBSCRIPTION_REQUIRED');
 return {user,access:{kind:'subscription',productCode:active.productCode,validUntil:active.currentPeriodEnd}};
}