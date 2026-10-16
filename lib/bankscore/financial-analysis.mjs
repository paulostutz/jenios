import {unavailableJeniosIndex} from './jenios-index.mjs';
/** Offline analysis of reviewed consolidated statements. Not connected to production.
 * `reviewed` is an ingestion precondition, never a client-controlled authorization.
 * Values are BRL, not thousands. Net income must be quarter-only, not YTD.
 */
const metrics = {
  equity: 'Patrimônio líquido', totalAssets: 'Ativos totais',
  netIncomeQuarter: 'Resultado do trimestre', provisions: 'Provisões para perdas',
};
const quarter = p => /^20\d{2}(03|06|09|12)$/.test(String(p));
const ordinal = p => Number(String(p).slice(0,4))*4 + Number(String(p).slice(4))/3;
const dated = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) && Number.isFinite(Date.parse(x));
const source = x => { try { return new URL(x).protocol === 'https:'; } catch { return false; } };
export function analyzeFinancialStatements(rows, {institutionCode, asOf = new Date().toISOString()} = {}) {
  if (!/^(?:\d{1,12}|C\d{1,12})$/.test(String(institutionCode)) || !dated(asOf) || !Array.isArray(rows)) throw Error('Identidade, data ou série inválida.');
  const rejected = [], accepted = [];
  rows.forEach((r,index) => {
    let reason;
    if (!r || r.institutionCode !== institutionCode) reason = 'INSTITUICAO_DIVERGENTE';
    else if (!quarter(r.period)) reason = 'PERIODO_INVALIDO';
    else if (r.reviewed !== true || !source(r.sourceUrl) || !dated(r.publishedAt) || !dated(r.retrievedAt) || !r.documentId) reason = 'FONTE_OU_REVISAO_AUSENTE';
    else if (Date.parse(r.publishedAt)>Date.parse(asOf) || Date.parse(r.retrievedAt)>Date.parse(asOf) || Date.parse(r.publishedAt)>Date.parse(r.retrievedAt)) reason = 'DATA_INCONSISTENTE';
    else if (Date.parse(r.publishedAt) < Date.UTC(Number(String(r.period).slice(0,4)), Number(String(r.period).slice(4)), 0)) reason = 'PUBLICACAO_ANTERIOR_AO_PERIODO';
    else if (!['consolidated_accounting','prudential'].includes(r.scope) || !r.consolidationId || !r.accountingStandard) reason = 'PERIMETRO_AUSENTE';
    else if (r.currency !== 'BRL' || r.scale !== 1) reason = 'UNIDADE_NAO_NORMALIZADA';
    else if (r.netIncomeQuarter != null && r.incomeBasis !== 'quarter_only') reason = 'RESULTADO_NAO_TRIMESTRAL';
    else if (Object.keys(metrics).some(k => r[k] != null && !Number.isFinite(r[k]))) reason = 'VALOR_INVALIDO';
    else if ((r.totalAssets != null && r.totalAssets <= 0) || (r.provisions != null && r.provisions < 0)) reason = 'VALOR_INCONSISTENTE';
    if(reason) rejected.push({index,reason}); else accepted.push(r);
  });
  const counts = new Map();
  for(const r of accepted) counts.set(String(r.period),(counts.get(String(r.period))||0)+1);
  const duplicates = [...counts].filter(([,n])=>n>1).map(([p])=>p);
  const points = accepted.filter(r=>counts.get(String(r.period))===1).sort((a,b)=>Number(b.period)-Number(a.period)).slice(0,3);
  const comparable = points.length===3 && points.every((r,i)=>!i || (
    ordinal(points[i-1].period)-ordinal(r.period)===1 && r.scope===points[0].scope &&
    r.consolidationId===points[0].consolidationId && r.accountingStandard===points[0].accountingStandard));
  const missing = Object.keys(metrics).filter(k=>points.length!==3 || points.some(r=>r[k]==null));
  const changes = comparable ? Object.fromEntries(Object.keys(metrics).map(k=>{
    const current=points[0][k],previous=points[1][k];
    return [k,current==null||previous==null?null:{absolute:current-previous,percent:previous>0?(current-previous)/previous*100:null}];
  })) : {};
  const observations=[];
  if(points[0]?.equity != null && points[0].equity<=0) observations.push('O patrimônio líquido informado é nulo ou negativo. Isso exige análise prioritária das perdas, medidas de recomposição e divulgações oficiais; isoladamente, não determina liquidação.');
  if(comparable && points.every(r=>r.equity!=null) && points[0].equity<points[1].equity && points[1].equity<points[2].equity) observations.push('O patrimônio líquido caiu nas duas comparações consecutivas. Conferir prejuízos, distribuições e outros ajustes patrimoniais antes de atribuir a causa.');
  if(points[0]?.netIncomeQuarter<0) observations.push('O último trimestre disponível registra prejuízo. Um resultado isolado não permite concluir insolvência.');
  if(!comparable) observations.push('Ainda não há três trimestres consecutivos com o mesmo perímetro e padrão contábil para comparação.');
  return {
    status:comparable&&!missing.length&&!duplicates.length&&!rejected.length?'SERIE_CONTABIL_DISPONIVEL':'COBERTURA_INCOMPLETA',
    institutionCode,asOf,latestAvailablePeriod:points[0]?.period??null,
    latestPublicationVerified:false, // ingestion must separately reconcile against the publisher's catalogue
    points,comparable,changes,missing,rejected,duplicatePeriods:duplicates,observations,
    score:unavailableJeniosIndex({dataComplete:comparable&&!missing.length&&!duplicates.length&&!rejected.length,period:points[0]?.period??null}),
    opinion:'A decisão exige também capital regulatório, liquidez, qualidade do crédito, auditoria e eventos posteriores à data-base. Esta análise contábil não conclui se é seguro manter ou investir recursos.',
    guide:{equity:'Patrimônio líquido é a diferença contábil entre ativos e passivos; não é caixa disponível nem o mesmo que capital regulatório.',netIncomeQuarter:'Lucro ou prejuízo apenas dos três meses. Resultado acumulado no ano não pode ser comparado diretamente ao trimestre.',provisions:'Provisões reconhecem perdas esperadas. A alta pode refletir risco maior, mudança de carteira ou ajuste de cobertura.',totalAssets:'O crescimento dos ativos mostra expansão, mas não demonstra, sozinho, melhora da qualidade ou segurança.'}
  };
}
