import snapshot from '../../data/bankscore/financial-snapshot.mjs';
import {buildFinancialAppendix} from './financial-appendix.mjs';
export function loadFinancialAppendix(target){return buildFinancialAppendix(snapshot,target);}
