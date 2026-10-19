/**
 * JENIOS Platform — política de roteamento inicial (educacional).
 * Este módulo NÃO autoriza ordens reais: o laudo local é apenas uma preferência
 * de interface; permissões financeiras exigem validação no servidor.
 */
export const REPORT_KEY = 'jenios_diagnostico_laudo';
export const MODE_KEY = 'jenios_modo_operacional';
const TRAITS = ['impulsivo','ansioso','teimoso','hesitante','tecnico_positivo'];
const clean = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

export function classifyDiagnostic(scores = {}) {
  const s = Object.fromEntries(TRAITS.map(k => [k, clean(scores[k])]));
  const risk = s.impulsivo + s.ansioso + s.teimoso + s.hesitante;
  const highRisk = s.impulsivo + s.teimoso;
  const manual = s.tecnico_positivo >= 6 && s.tecnico_positivo > risk && highRisk <= 2;
  return {
    mode: manual ? 'manual' : 'reversa',
    rationale: manual
      ? 'Respostas indicam preferência por regras e disciplina operacional; a orientação inicial é o modo manual.'
      : 'As respostas sugerem trabalhar primeiro com uma simulação reversa e controles adicionais de risco.',
    scores: s,
    methodology: 'JENIOS-UX-1',
    isPerformancePrediction: false
  };
}

export function readLocalReport(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const report = JSON.parse(storage.getItem(REPORT_KEY) || 'null');
    if (!report || report.methodology !== 'JENIOS-UX-1'
      || !['manual','reversa'].includes(report.mode)
      || typeof report.date !== 'string' || !report.scores) return null;
    return report;
  } catch { return null; }
}

export function persistLocalReport(storage, scores, timeframe, date = new Date().toISOString()) {
  if (!storage || typeof storage.setItem !== 'function') return null;
  if (!['RAPIDO','ESTRUTURADO','SWING'].includes(timeframe)) return null;
  const profile = classifyDiagnostic(scores);
  const report = { ...profile, timeframe, date };
  storage.setItem(REPORT_KEY, JSON.stringify(report));
  storage.setItem(MODE_KEY, profile.mode);
  storage.setItem('jenios_diagnostico_realizado', 'true'); // legado, não autorização
  storage.setItem('jenios_diagnostico_data', date);
  return report;
}

// Critério necessário, NÃO suficiente: o servidor também deve validar conta,
// corretora, contrato e permissões. Flags do navegador não habilitam execução.
export function canExecuteReal({ serverDiagnosticVerified = false, serverAccountReady = false, serverBrokerReady = false, executionAuthorized = false } = {}) {
  return serverDiagnosticVerified === true && serverAccountReady === true
    && serverBrokerReady === true && executionAuthorized === true;
}

export function adaptiveModeSuggestion(trades, mode = 'manual') {
  if (!Array.isArray(trades)) return null;
  const last = trades.slice(-5);
  if (last.length < 5 || last.some(t => t?.verified !== true || !Number.isFinite(t.pnl))) return null;
  const total = last.reduce((a,t) => a+t.pnl,0);
  const recentLosses = last.slice(-3).every(t => t.pnl < 0);
  if (mode === 'manual' && recentLosses && total < 0) {
    return 'As últimas operações verificadas registram perdas seguidas. Considere pausar, revisar o risco e estudar o modo reverso na simulação. A decisão continua sua.';
  }
  return null;
}

/** Uma tentativa bloqueada não comprova perda evitada: só eventos verificados são contados. */
export function protectionSummary(events) {
  if (!Array.isArray(events)) return { blocked: 0, avoidedLoss: null };
  const blocked = events.filter(e => e?.verified === true && e?.type === 'risk_block').length;
  return { blocked, avoidedLoss: null };
}
