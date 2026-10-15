import { avaliarIndicador, periodoValido } from './laudo-core.mjs';
import { montarLaudo } from './report-core.mjs';
import { loadCapitalReport } from './capital-report.mjs';
export const BANKSCORE_DETAILED_UNAVAILABLE = 'A análise financeira completa exige dados complementares e metodologia validada. O laudo de capitalização contratado utiliza somente o indicador e o histórico disponíveis, com seus limites explícitos.';

export async function assertBankscoreDetailedReady(input) { await loadCapitalReport(input); }
export function withBankscoreAvailability(product) { return product.code === 'social-bankscore-report' ? { ...product, serviceReady: true, description:'Laudo de capitalização com o indicador disponível, interpretação e histórico. Não inclui análise financeira completa; dados provisórios identificados.', unavailableReason:null } : product; }
export function bankscoreTarget(input) {
  const codigo = String(input?.codigo || ''), periodo = String(input?.periodo || '');
  if (!/^(?:\d{1,12}|C\d{1,12})$/.test(codigo) || (periodo && !periodoValido(periodo))) throw Object.assign(new Error('Instituição ou período inválido.'), { status: 400 });
  return { codigo, periodo };
}
export function lastClosedQuarter(now = new Date()) {
  const month = Math.floor(now.getUTCMonth() / 3) * 3;
  return month ? now.getUTCFullYear() * 100 + month : (now.getUTCFullYear() - 1) * 100 + 12;
}
export function bankscoreCoverage(current, history = [], indicators = [], now = new Date()) {
  if (!periodoValido(String(current?.periodo))) throw Object.assign(new Error('Período da base inconsistente.'), { status: 409 });
  const checked = avaliarIndicador(current);
  const institution = { codigo: current.codigo_instituicao, nome: current.nome_instituicao, periodo: current.periodo, tipo: current.tipo_instituicao, percentual: checked.percentual, revisao: checked.revisao, status: current.status };
  const groups = new Map();
  for (const row of history) { const key = String(row.periodo); groups.set(key, [...(groups.get(key) || []), row]); }
  const series = [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 8).map(([periodo, rows]) => {
    const result = !periodoValido(periodo) ? { percentual: null, revisao: 'PERIODO_INVALIDO', valido: false } : rows.length === 1 ? avaliarIndicador(rows[0]) : { percentual: null, revisao: 'DUPLICADO', valido: false };
    return { periodo: Number(periodo), percentual: result.valido ? result.percentual : null, revisao: result.revisao };
  });
  return { ...montarLaudo(institution), coverage: {
    checkedAt: now.toISOString(), detailedAvailable: false, reason: BANKSCORE_DETAILED_UNAVAILABLE,
    latestClosedCalendarQuarter: lastClosedQuarter(now), olderThanClosedQuarter: Number(current.periodo) < lastClosedQuarter(now),
    periodNotice: 'Trimestre civil encerrado não significa que o BCB já publicou os respectivos dados. A data de publicação não foi verificada.',
    dimensions: [
      { key: 'capital', label: 'Capitalização', state: checked.valido ? 'provisional' : 'under_review', explanation: 'Índice de Basileia provisório; sem requisito regulatório específico validado.' },
      ...['Liquidez', 'Inadimplência e qualidade dos ativos', 'Rentabilidade', 'Provisões', 'Enquadramento e adicionais regulatórios'].map(label => ({ key: label, label, state: 'not_validated', explanation: 'Não há dados e metodologia suficientes para uma conclusão validada nesta dimensão.' })),
    ], series,
    supplementalIndicators: indicators.map(row => ({ code: row.codigo_indicador, name: row.nome_indicador, rawValue: row.valor_bruto == null || !Number.isFinite(Number(row.valor_bruto)) ? null : Number(row.valor_bruto), source: row.fonte, updatedAt: row.atualizado_em, unit: 'não validada' })),
    limitations: ['O diagnóstico de cobertura integra o laudo contratado e descreve o indicador de capitalização disponível; não oferece análise financeira completa.', 'Ausência de dado não equivale a zero, insolvência ou ausência de risco.', 'Uma série curta ou irregular não fundamenta tendência estatística ou previsão de liquidação.', 'Indicadores complementares brutos, quando presentes, não são convertidos em percentuais ou valores monetários sem unidade validada.'],
  } };
}

export async function loadBankscoreCoverage({ db, target, now = new Date() }) {
  const { codigo, periodo: selected } = bankscoreTarget(target);
  const table = 'jenios_bankscore_homologacao';
  let periodo = selected ? Number(selected) : null;
  if (!periodo) {
    const latest = await db.from(table).select('periodo').eq('codigo_instituicao', codigo).eq('codigo_indicador', '79664').order('periodo', { ascending: false }).limit(1);
    if (latest.error) throw latest.error;
    periodo = latest.data?.[0]?.periodo;
  }
  if (!periodo) throw Object.assign(new Error('Instituição sem período disponível.'), { status: 404 });
  if (!periodoValido(String(periodo))) throw Object.assign(new Error('Período da base inconsistente.'), { status: 409 });
  const fields = 'codigo_instituicao,nome_instituicao,periodo,tipo_instituicao,codigo_indicador,indice_basileia_bruto,indice_basileia_percentual_provisorio,status';
  const current = await db.from(table).select(fields).eq('codigo_instituicao', codigo).eq('periodo', periodo).eq('codigo_indicador', '79664').limit(2);
  if (current.error) throw current.error;
  if (!current.data?.length) throw Object.assign(new Error('Instituição não encontrada neste período.'), { status: 404 });
  if (current.data.length > 1) throw Object.assign(new Error('Dados duplicados: revisão necessária.'), { status: 409 });
  const history = await db.from(table).select(fields).eq('codigo_instituicao', codigo).eq('codigo_indicador', '79664').lte('periodo', periodo).order('periodo', { ascending: false }).limit(100);
  if (history.error) throw history.error;
  if (history.data?.length === 100) throw Object.assign(new Error('Histórico excede o limite de conferência; revisão necessária.'), { status: 409 });
  const extra = await db.from('bankscore_indicadores').select('codigo_indicador,nome_indicador,valor_bruto,fonte,atualizado_em').eq('codigo_instituicao', codigo).eq('periodo', periodo).order('codigo_indicador').limit(101);
  if (extra.error) throw extra.error;
  if (extra.data?.length > 100) throw Object.assign(new Error('Inventário complementar excede o limite de conferência.'), { status: 409 });
  return bankscoreCoverage(current.data[0], history.data || [], extra.data || [], now);
}
