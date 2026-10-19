/**
 * JENIOS Platform — diagnóstico persistido e associado à conta autenticada.
 * Não autoriza corretoras, ordens ou operação financeira real.
 * O formulário é um instrumento de orientação, não diagnóstico psicológico clínico.
 */
export const DIAGNOSTIC_VERSION = 'JENIOS-UX-2';
export const DIAGNOSTIC_TABLE = 'jenios_platform_diagnostics';
export const MODES = Object.freeze(['manual','reversa']);
export const TIMEFRAMES = Object.freeze(['RAPIDO','ESTRUTURADO','SWING']);
const TRAIT_KEYS = Object.freeze(['impulsivo','ansioso','teimoso','hesitante','tecnico_positivo']);

export function normalizeDiagnosticForm(form) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) throw invalid();
  const {answers,timeframe} = form;
  if (!Array.isArray(answers) || answers.length !== 5 ||
      !answers.every(i=>Number.isInteger(i) && i>=0 && i<=4) ||
      !TIMEFRAMES.includes(timeframe)) throw invalid();
  return {answers:[...answers],timeframe};
}
function invalid() { return Object.assign(new Error('Preencha todas as etapas do diagnóstico.'),{status:400}); }

export function classifyServerDiagnostic(form) {
  const {answers,timeframe} = normalizeDiagnosticForm(form);
  const scores = Object.fromEntries(TRAIT_KEYS.map(k=>[k,0]));
  for (const index of answers) scores[TRAIT_KEYS[index]] += 2;
  const risk = scores.impulsivo+scores.ansioso+scores.teimoso+scores.hesitante;
  const severe = scores.impulsivo+scores.teimoso;
  const mode = scores.tecnico_positivo>=6 && scores.tecnico_positivo>risk && severe<=2 ? 'manual':'reversa';
  return {answers,timeframe,scores,initial_mode:mode,methodology:DIAGNOSTIC_VERSION};
}

export function projectVerifiedDiagnostic(row) {
  if (!row || !MODES.includes(row.initial_mode) ||
      row.methodology!==DIAGNOSTIC_VERSION || !TIMEFRAMES.includes(row.timeframe)) return null;
  return {completed:true,verified:true,mode:row.initial_mode,
    timeframe:row.timeframe,methodology:row.methodology,createdAt:row.created_at};
}

export async function readVerifiedDiagnostic(db,user) {
  if (!user?.id || user.is_anonymous) throw Object.assign(new Error('Entre com sua conta.'),{status:401});
  const result = await db.from(DIAGNOSTIC_TABLE)
    .select('initial_mode,timeframe,methodology,created_at')
    .eq('user_id',user.id).maybeSingle();
  if (result.error) throw Object.assign(new Error('Diagnóstico indisponível para validação no servidor.'),{status:503});
  const data = projectVerifiedDiagnostic(result.data);
  return data || {completed:false,verified:false};
}

export async function saveVerifiedDiagnostic(db,user,form) {
  if (!user?.id || user.is_anonymous) throw Object.assign(new Error('Entre com sua conta.'),{status:401});
  const record = classifyServerDiagnostic(form);
  const existing = await readVerifiedDiagnostic(db,user);
  if (existing.verified) return existing;
  const result = await db.from(DIAGNOSTIC_TABLE).insert({
    user_id:user.id,...record
  });
  // Concorrência: primeira submissão vence; demais recuperam o mesmo laudo.
  if (result.error && result.error.code !== '23505') {
    throw Object.assign(new Error('Não foi possível salvar o diagnóstico no servidor.'),{status:503});
  }
  const saved = await readVerifiedDiagnostic(db,user);
  if (!saved.verified) throw Object.assign(new Error('Não foi possível confirmar o registro.'),{status:503});
  return saved;
}
