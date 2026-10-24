'use client';

import { useState } from 'react';
import { evaluateR61AssistedAcceptance } from '../../../lib/platform/research/robot-r61-assisted-acceptance.mjs';
import {
  createR61UltraSession, stepR61UltraSession, restartR61UltraSession,
  R61_ULTRA_ASSETS, R61_ULTRA_SCENARIOS,
} from '../../../lib/platform/research/robot-r61-ultrafast-acceptance.mjs';

const actionLabels = {
  MANUAL_CONTROL: 'Manual · você mantém o controle',
  ADVISE_REVIEW: 'Híbrido · revisar a intenção',
  KEEP_OPERATOR_DECISION: 'Manter a decisão do operador',
  REVERSE_REFERENCE: 'Reverso · referência de inversão seletiva',
};
const reasonLabels = {
  SUGGEST_PAUSE_AND_REVIEW: 'A sequência de perdas sugere pausa e revisão.',
  SESSION_RISK_WARNING: 'O risco acumulado da sessão merece revisão.',
  LOW_SIGNAL_CONFIDENCE: 'A confiança informada no cenário é baixa.',
  OFFER_CONTEXTUAL_ANALYSIS: 'O operador solicitou ajuda contextual.',
  OPERATOR_ALREADY_ALIGNED: 'Operador e contexto já estão alinhados.',
  MATERIAL_DISAGREEMENT: 'Há discordância material com confiança suficiente para orientação.',
  LOW_CONFIDENCE_OR_NO_SIDE: 'Confiança insuficiente para intervir.',
  LOW_CONFIDENCE: 'A baixa confiança impede a inversão.',
  NO_MATERIAL_DISAGREEMENT: 'Operador e contexto estão alinhados; não há discordância material para inverter.',
  MEGATREND_EXCEPTION: 'A exceção de megatendência impede a inversão.',
};
const sideLabel = (side) => side === 'buy' ? 'Compra' : side === 'sell' ? 'Venda' : 'Sem referência';
const panel = { background: '#172134', border: '1px solid #334155', padding: 22, borderRadius: 16, minWidth: 0 };
const fieldStyle = { width: '100%', minWidth: 0, background: '#0b1220', color: '#f8fafc', border: '1px solid #64748b', borderRadius: 9, padding: '10px 12px', boxSizing: 'border-box', fontSize: 14 };
const buttonStyle = { background: '#c4b5fd', color: '#1e1b4b', border: 0, borderRadius: 9, padding: '11px 16px', fontWeight: 800, cursor: 'pointer', fontSize: 14 };
const quietButton = { ...buttonStyle, background: '#334155', color: '#f8fafc' };
const rowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 };

function Field({ label, children }) {
  return <label style={{ display: 'grid', gap: 7, minWidth: 0, fontSize: 13, color: '#cbd5e1' }}>{label}{children}</label>;
}

function numeric(value) {
  if (typeof value === 'string' && !value.trim()) throw new Error('Preencha todos os valores do cenário.');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Use somente valores numéricos finitos.');
  return number;
}

function AssistedConsole() {
  const [input, setInput] = useState({ mode: 'manual', operatorSide: 'buy', technicalSide: 'sell', confidence: '0.85', consecutiveLosses: '4', sessionDrawdownR: '6', operatorRequestedHelp: false, megaTrend: false, syntheticLossIfFollowedR: '2' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const update = (key, value) => { setInput((before) => ({ ...before, [key]: value })); setResult(null); setError(''); };
  const evaluate = (event) => {
    event.preventDefault();
    setResult(null);
    setError('');
    try {
      setResult(evaluateR61AssistedAcceptance({
        ...input,
        source: 'synthetic_fixture',
        confidence: numeric(input.confidence),
        consecutiveLosses: numeric(input.consecutiveLosses),
        sessionDrawdownR: numeric(input.sessionDrawdownR),
        syntheticLossIfFollowedR: numeric(input.syntheticLossIfFollowedR),
      }));
    } catch {
      setError('Cenário inválido. Confira os números, os lados e a confiança entre 0 e 1. Nenhuma decisão anterior continua válida.');
    }
  };
  return <section style={panel} aria-labelledby="assisted-title">
    <h2 id="assisted-title" style={{ marginTop: 0 }}>Manual, Híbrido e Reverso</h2>
    <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>Preencha uma situação fictícia e confira a resposta da política. A avaliação não muda seu modo nem executa entradas ou saídas. O limiar do Híbrido e do Reverso permanece em <strong>0,65</strong>.</p>
    <form onSubmit={evaluate} style={{ display: 'grid', gap: 16 }}>
      <div style={rowStyle}>
        <Field label="Modo em homologação"><select data-testid="assisted-mode" value={input.mode} onChange={(e) => update('mode', e.target.value)} style={fieldStyle}><option value="manual">Manual</option><option value="hybrid">Híbrido</option><option value="reverse">Reverso</option></select></Field>
        <Field label="Intenção fictícia do operador"><select data-testid="operator-side" value={input.operatorSide} onChange={(e) => update('operatorSide', e.target.value)} style={fieldStyle}><option value="buy">Compra</option><option value="sell">Venda</option></select></Field>
        <Field label="Direção do contexto sintético"><select data-testid="technical-side" value={input.technicalSide} onChange={(e) => update('technicalSide', e.target.value)} style={fieldStyle}><option value="buy">Compra</option><option value="sell">Venda</option></select></Field>
        <Field label="Confiança sintética (0 a 1)"><input data-testid="confidence" type="number" min="0" max="1" step="0.01" required value={input.confidence} onChange={(e) => update('confidence', e.target.value)} style={fieldStyle} /></Field>
        <Field label="Perdas consecutivas fictícias"><input data-testid="consecutive-losses" type="number" min="0" step="1" required value={input.consecutiveLosses} onChange={(e) => update('consecutiveLosses', e.target.value)} style={fieldStyle} /></Field>
        <Field label="Drawdown fictício da sessão (R)"><input data-testid="drawdown" type="number" min="0" step="0.1" required value={input.sessionDrawdownR} onChange={(e) => update('sessionDrawdownR', e.target.value)} style={fieldStyle} /></Field>
        <Field label="Perda hipotética da intenção (R)"><input data-testid="hypothetical-loss" type="number" min="0" step="0.1" required value={input.syntheticLossIfFollowedR} onChange={(e) => update('syntheticLossIfFollowedR', e.target.value)} style={fieldStyle} /></Field>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, color: '#cbd5e1', fontSize: 14 }}>
        <label><input data-testid="megatrend" type="checkbox" checked={input.megaTrend} onChange={(e) => update('megaTrend', e.target.checked)} /> Megatendência no cenário</label>
        <label><input data-testid="operator-help" type="checkbox" checked={input.operatorRequestedHelp} onChange={(e) => update('operatorRequestedHelp', e.target.checked)} /> Operador pediu ajuda</label>
      </div>
      <button type="submit" data-testid="assisted-evaluate" style={buttonStyle}>Avaliar cenário sintético</button>
    </form>
    {error && <p role="alert" style={{ color: '#fda4af' }}>{error}</p>}
    {!result && !error && <p data-testid="assisted-empty" style={{ color: '#94a3b8', fontSize: 14 }}>Aguardando avaliação. Alterar qualquer parâmetro invalida o resultado anterior.</p>}
    {result && <div data-testid="assisted-result" data-action={result.action} data-suggested-side={result.suggestedSide || ''} aria-live="polite" style={{ marginTop: 20, padding: 18, border: '1px solid #a78bfa', borderRadius: 12 }}>
      <h3 style={{ color: '#ddd6fe', marginTop: 0 }}>{actionLabels[result.action]}</h3>
      <p>Intenção: <strong>{sideLabel(result.operatorSide)}</strong>. Referência apresentada: <strong data-testid="assisted-side">{sideLabel(result.suggestedSide)}</strong>.</p>
      {result.reasonCodes.length > 0 && <ul data-testid="assisted-reasons" style={{ paddingLeft: 20, color: '#e2e8f0', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{result.reasonCodes.map((code) => <li key={code}>{reasonLabels[code] || (code.includes('MEGATREND') ? 'A megatendência impede a inversão.' : code.includes('LOW_CONFIDENCE') ? 'A baixa confiança impede a intervenção.' : 'A política manteve as proteções do cenário.')} <small style={{ color: '#94a3b8' }}>({code})</small></li>)}</ul>}
      <p style={{ color: '#cbd5e1', fontSize: 14 }}>Controle do operador preservado. Ordens reais: <strong>{result.realOrdersSent}</strong>. Paper externo: <strong>{result.externalPaperOrdersSent}</strong>.</p>
      {result.mode === 'reverse' && <p data-testid="losseshometro" style={{ color: '#fcd34d' }}>Losseshômetro sintético: {result.losseshometro.hypotheticalLossAvoidedR ?? 0} R de hipótese deste cenário. Não é dinheiro nem perda real evitada.</p>}
      <details style={{ color: '#94a3b8', fontSize: 13 }}><summary>Rastreabilidade da avaliação</summary><p>Origem: {result.provenance.kind}. Políticas: {result.provenance.policyModules.join(', ')}. Limiar: {result.alignmentGuardThreshold}. Nenhuma observação de mercado real.</p></details>
    </div>}
  </section>;
}

function UltraConsole() {
  const [config, setConfig] = useState({ planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: '1000', leverage: '2' });
  const [scenario, setScenario] = useState('normal');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const update = (key, value) => { setConfig((before) => ({ ...before, [key]: value })); setSession(null); setError(''); };
  const start = () => {
    setError('');
    try {
      const input = { ...config, evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'qa-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9), capital: numeric(config.capital), leverage: numeric(config.leverage) };
      let next = session ? restartR61UltraSession(session, input) : createR61UltraSession(input);
      next = stepR61UltraSession(next, { type: 'snapshot', scenario: 'normal' });
      next = stepR61UltraSession(next, { type: 'snapshot', scenario: 'normal' });
      setSession(next);
    } catch {
      setSession(null);
      setError('Configuração inválida. Use um ativo do catálogo, capital positivo e alavancagem permitida. Nenhuma sessão continua autorizada.');
    }
  };
  const advance = (event) => {
    if (!session) return;
    setError('');
    try { setSession(stepR61UltraSession(session, event)); }
    catch { setSession(null); setError('O evento não pôde ser validado. A sessão foi encerrada nesta tela; inicie uma nova homologação.'); }
  };
  return <section style={panel} aria-labelledby="ultra-title">
    <h2 id="ultra-title" style={{ marginTop: 0 }}>UltraFast · sessão de homologação</h2>
    <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>Escolha parâmetros fictícios e aplique eventos de teste. Iniciar cria uma sessão nova e avalia dois snapshots sintéticos favoráveis. Cada cenário posterior avança somente por seu clique.</p>
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={rowStyle}>
        <Field label="Plano simulado"><select data-testid="ultra-plan" value={config.planCode} onChange={(e) => update('planCode', e.target.value)} style={fieldStyle}><option value="platform-nacional">Nacional · sem UltraFast</option><option value="platform-global-crypto">Global Crypto · intermediário</option><option value="platform-internacional-pro">Internacional Pro</option></select></Field>
        <Field label="Ativo sintético"><select data-testid="ultra-symbol" value={config.symbol} onChange={(e) => update('symbol', e.target.value)} style={fieldStyle}>{R61_ULTRA_ASSETS.map((asset) => <option key={asset.symbol} value={asset.symbol}>{asset.label}</option>)}</select></Field>
        <Field label="Capital fictício"><input data-testid="ultra-capital" type="number" min="1" step="1" value={config.capital} onChange={(e) => update('capital', e.target.value)} style={fieldStyle} /></Field>
        <Field label="Alavancagem de teste"><input data-testid="ultra-leverage" type="number" min="1" max="10" step="1" value={config.leverage} onChange={(e) => update('leverage', e.target.value)} style={fieldStyle} /></Field>
      </div>
      <button data-testid="ultra-start" type="button" onClick={start} style={buttonStyle}>Iniciar / nova sessão de homologação</button>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>O plano acima é somente uma entrada de teste e não concede acesso a uma conta. Capital e alavancagem não movimentam saldo. Taxa por operação da plataforma: nenhuma.</p>
      <Field label="Próximo evento sintético"><select data-testid="ultra-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)} style={fieldStyle}>{R61_ULTRA_SCENARIOS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></Field>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button data-testid="ultra-step" type="button" disabled={!session || session.status !== 'RUNNING'} onClick={() => advance({ type: 'snapshot', scenario })} style={quietButton}>Aplicar evento</button>
        <button data-testid="ultra-pause" type="button" disabled={!session || session.status !== 'RUNNING'} onClick={() => advance({ type: 'pause' })} style={quietButton}>Pausar sessão</button>
        <button data-testid="ultra-resume" type="button" disabled={!session || session.status !== 'PAUSED'} onClick={() => advance({ type: 'resume' })} style={quietButton}>Retomar sessão</button>
      </div>
    </div>
    {error && <p role="alert" data-testid="ultra-error" style={{ color: '#fda4af' }}>{error}</p>}
    {!session && !error && <p data-testid="ultra-empty" style={{ color: '#94a3b8', fontSize: 14 }}>Nenhuma sessão iniciada. Alterar plano, ativo, capital ou alavancagem invalida a sessão anterior.</p>}
    {session && <div data-testid="ultra-result" data-status={session.status} data-allow={String(session.allowSyntheticDecision)} data-events={session.eventCount} data-session-id={session.config.sessionId} aria-live="polite" style={{ marginTop: 20, padding: 18, border: '1px solid #a78bfa', borderRadius: 12 }}>
      <h3 style={{ marginTop: 0, color: '#ddd6fe' }}>{session.status === 'PAUSED' ? 'Sessão pausada' : session.status === 'HALTED' ? 'Sessão interrompida por risco' : session.allowSyntheticDecision ? 'Decisão sintética permitida' : 'Decisão sintética bloqueada'}</h3>
      <p>Estado: <strong data-testid="ultra-state">{session.status}</strong>. Eventos: <strong>{session.eventCount}</strong>. Referência: <strong>{sideLabel(session.suggestedSide)}</strong>.</p>
      <p style={{ color: '#cbd5e1', fontSize: 14 }}>Permitir uma decisão sintética não envia uma ordem. Ordens reais: <strong>{session.realOrdersSent}</strong>. Paper externo: <strong>{session.externalPaperOrdersSent}</strong>.</p>
      {session.status === 'HALTED' && <p style={{ color: '#fcd34d' }}>Esta sessão não retoma automaticamente. Para nova avaliação, use Iniciar / nova sessão de homologação.</p>}
      {session.reasons?.length > 0 && <ul data-testid="ultra-reasons" style={{ paddingLeft: 20, color: '#cbd5e1', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{session.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
      <details style={{ color: '#94a3b8', fontSize: 13 }}><summary>Rastreabilidade da sessão sintética</summary><p>Esta avaliação usa os módulos de pesquisa existentes para os controles ligados no adapter. Não comprova preenchimento, latência ou lucro de corretora.</p><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(session.gates, null, 2)}</pre></details>
    </div>}
  </section>;
}

export default function PlatformRobotAcceptanceConsole() {
  return <main data-testid="robot-acceptance-console" style={{ minHeight: '100vh', background: '#0b1220', color: '#f8fafc', fontFamily: 'system-ui,sans-serif', padding: 'clamp(18px,4vw,48px)' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 24 }}>
      <header>
        <a href="/platform/homologacao" style={{ color: '#c4b5fd', fontSize: 14 }}>← Voltar à homologação</a>
        <p style={{ letterSpacing: 2, color: '#c4b5fd', fontSize: 12, fontWeight: 800, marginTop: 26 }}>JENIOS PLATFORM · HOMOLOGAÇÃO DOS ROBÔS</p>
        <h1 style={{ fontSize: 'clamp(26px,4vw,38px)', margin: '10px 0' }}>Quatro modos, decisões verificáveis</h1>
        <p style={{ color: '#cbd5e1', lineHeight: 1.7, maxWidth: 820 }}>Console isolado que liga os controles da tela às políticas de pesquisa. Todos os dados desta página são sintéticos. Nenhuma conexão com corretora, ordem real, Paper externo ou saldo de cliente é usado.</p>
      </header>
      <div role="note" style={{ padding: '16px 20px', background: '#302344', border: '1px solid #a78bfa', borderRadius: 12, color: '#e9d5ff', lineHeight: 1.6 }}>
        <strong>Escopo desta homologação:</strong> comportamento da interface e das políticas com cenários fictícios. O resultado não certifica rentabilidade real nem autoriza produção. O limiar 0,65 não é taxa de acerto.
      </div>
      <AssistedConsole />
      <UltraConsole />
      <footer data-testid="real-evidence-boundary" style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, paddingBottom: 20 }}>Lucro real, perdas reais evitadas e acurácia real: não medidos, permanecem nulos. Nada é salvo em conta, banco ou corretora. Recarregar descarta os resultados desta sessão. O histórico prospectivo R15 permanece preservado.</footer>
    </div>
  </main>;
}
