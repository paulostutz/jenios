import { requirePaidPurchase } from './access.mjs';
import { loadCapitalReport } from '../bankscore/capital-report.mjs';
export async function deliverBankscoreReport({db,user,orderId,target,load=loadCapitalReport}) {
  const access=await requirePaidPurchase({db,user,orderId,productCode:'social-bankscore-report',target});
  const report=await load({db,target:access.target});
  return {...report,orderId:access.orderId};
}
