/** IFData DRE: March/September are quarters; June/December accumulate semesters.
 * Inputs must already be sourced and normalized by ingestion. No publication approval here.
 */
export function quarterIncome(current,previous=null) {
  const valid=r=>r && /^(?:\d{1,12}|C\d{1,12})$/.test(r.institutionCode||'') && /^20\d{2}(03|06|09|12)$/.test(String(r.period)) && Number.isFinite(r.value) && r.currency==='BRL' && r.scale===1 && r.basis==='semester_to_date' && r.scope && r.accountingStandard && r.sourceUrl && r.documentId;
  if(!valid(current))throw Error('Resultado sem origem, unidade ou base semestral confirmada.');
  const month=Number(String(current.period).slice(4));
  if(month===3||month===9)return {...current,basis:'quarter_only',reviewed:false,derivation:{method:'FIRST_QUARTER_OF_SEMESTER',documents:[current.documentId]}};
  if(!valid(previous)||Number(previous.period)!==Number(current.period)-3 || ['institutionCode','scope','consolidationId','accountingStandard','currency','scale'].some(k=>!current[k]||current[k]!==previous[k])) throw Error('Falta trimestre anterior comparável do mesmo semestre.');
  return {...current,value:current.value-previous.value,basis:'quarter_only',reviewed:false,derivation:{method:'SEMESTER_MINUS_FIRST_QUARTER',documents:[current.documentId,previous.documentId]}};
}
