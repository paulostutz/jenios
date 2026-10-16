import {loadFinancialAppendix} from '../bankscore/financial-snapshot.mjs';
import {requirePaidPurchase} from './access.mjs';
import {loadCapitalReport} from '../bankscore/capital-report.mjs';
export async function deliverBankscoreReport({db,user,orderId,target,load=loadCapitalReport,authorize=requirePaidPurchase}) {
 const access=await authorize({db,user,orderId,productCode:'social-bankscore-report',target});
 const report=await load({db,target:access.target});
 let financial;
 try {financial=loadFinancialAppendix(access.target);} catch {financial={available:false,reason:'Não foi possível conferir a base de balanços nesta emissão.'};}
 return {...report,financial,orderId:access.orderId};
}
