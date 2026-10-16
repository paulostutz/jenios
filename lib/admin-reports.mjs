import {normalizePurchase,DEFAULT_PRODUCTS} from './pay/catalog.mjs';
import {normalizeCryptoRequest,validateCrypto} from './crypto-validator.mjs';
import {loadCapitalReport} from './bankscore/capital-report.mjs';
import {loadFinancialAppendix} from './bankscore/financial-snapshot.mjs';
import {loadBankscoreCoverage} from './bankscore/coverage.mjs';
import {walletInventory} from './crypto/wallet-inventory.mjs';
import {detailedCryptoReport} from './crypto/detailed.mjs';
export function adminReportTarget(kind,target){
 if(kind==='crypto')return normalizeCryptoRequest(target);
 if(kind==='bankscore')return normalizePurchase({target},DEFAULT_PRODUCTS.find(x=>x.code==='social-bankscore-report'),'social').target;
 throw Object.assign(Error('Consulta inválida.'),{status:400});
}
export async function issueAdminReport(db,kind,target){
 if(kind==='bankscore'){
  const report=await loadCapitalReport({db,target});
  try{report.financial=loadFinancialAppendix(target);}catch{report.financial={available:false,reason:'Base de balanços indisponível nesta emissão.'};}
  try{report.coverage=(await loadBankscoreCoverage({db,target})).coverage;}catch{report.coverageNotice='Indicadores complementares indisponíveis nesta emissão.';}
  return {...report,administrative:true};
 }
 const report=await validateCrypto(target);
 if(report.network!==target.network||report.type!==target.type||report.identifier!==target.identifier)throw Object.assign(Error('Resposta incompatível com a consulta.'),{status:502});
 const inventory=target.type==='wallet'&&!report.providerError&&report.supported!==false?await walletInventory(target):null;
 return {...detailedCryptoReport({...report,...(inventory?{inventory}:{})},null),administrative:true};
}
