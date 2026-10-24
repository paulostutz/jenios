import { requireR71AdminFeed } from '../../../lib/platform/research/robot-r71-admin-view.mjs';

const panel = { padding: 20, border: '1px solid #d8def0', borderRadius: 14, background: '#fff', minWidth: 0 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: 14 };
const date = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const maturity = { BASELINE: 'Política de referência', EVALUATING: 'Avaliação registrada em andamento',
  QA_APPLIED: 'Política candidata aplicada em QA', QA_ROLLED_BACK: 'Política de referência restaurada',
  QA_REJECTED: 'Candidata recusada e retirada deste histórico' };
const actions = { REGISTERED: 'Avaliação registrada', APPLIED: 'Política aplicada em QA',
  REJECTED_INCOMPLETE: 'Janela incompleta: candidata recusada', REJECTED_NO_IMPROVEMENT: 'Melhoria não demonstrada: candidata recusada',
  REJECTED_POLICY: 'Critérios da política não atendidos: candidata recusada', ROLLED_BACK: 'Reversão concluída' };
const metric = value => value === null ? 'Não avaliado' : value;

export default function PlatformRobotPrivateEvolutionReport({ feed }) {
  requireR71AdminFeed(feed);
  const state = feed.state, study = state?.latestStudy, pending = state?.pendingEvaluation, evaluation = state?.lastEvaluation;
  return <section data-testid="r71-private-report" aria-label="Evolução privada dos robôs em QA"
    style={{ display: 'grid', gap: 16, color: '#17243e', minWidth: 0, overflowWrap: 'anywhere' }}>
    <header style={{ ...panel, background: '#eef3ff' }}>
      <p style={{ fontWeight: 700, color: '#3655a2', marginTop: 0 }}>Homologação · núcleo privado e política externa</p>
      <h2 style={{ margin: '8px 0 12px', fontSize: 24 }}>Estudo, avaliação e versões da política de contexto</h2>
      <p data-testid="r71-provenance">Decisões e contextos de posição são sintéticos. A execução usa o núcleo original com uma política externa versionada. O código interno do núcleo não foi reajustado.</p>
      <p data-testid="r71-no-orders">Ordens reais: 0 · Paper externo: 0 · Chamadas pagas: 0 · Monitoramento de clientes: inativo.</p>
      <p style={{ marginBottom: 0 }}>A política permite encaminhar a existência de uma posição aos modos Híbrido e Reverso em QA. Manual, contextos sem posição e decisões pausadas preservam a saída original. Estes resultados não certificam rentabilidade nem desempenho financeiro real.</p>
    </header>
    <section style={panel} aria-label="Versão do núcleo e política externa">
      <h3 style={{ marginTop: 0 }}>Núcleo original e política externa</h3>
      <p>Núcleo fixo: <strong data-testid="r71-original-core-version">{feed.originalCoreVersion}</strong>. Identidade original: {feed.originalPolicyVersion}, geração {feed.originalGeneration}.</p>
      {state ? <>
        <p data-testid="r71-maturity"><strong>{maturity[state.maturity]}</strong></p>
        <dl style={{ ...grid, marginBottom: 0 }}>
          <div><dt>Política externa ativa</dt><dd data-testid="r71-active-version" style={{ margin: '6px 0 0', fontWeight: 700 }}>{state.activeVersion.versionId}</dd></div>
          <div><dt>Geração de ativação</dt><dd data-testid="r71-generation" style={{ margin: '6px 0 0', fontWeight: 700 }}>{state.activeVersion.activationGeneration}</dd></div>
          <div><dt>Encaminha posição existente</dt><dd data-testid="r71-position-forwarding" style={{ margin: '6px 0 0', fontWeight: 700 }}>{state.activeVersion.forwardPositionOpen ? 'Sim, na política de QA' : 'Não, referência original'}</dd></div>
        </dl>
        <p>Promoções neste histórico: {state.promotions} de 1. {state.candidateRetired ? 'A candidata foi retirada e não pode ser reaplicada neste histórico.' : 'A aplicação depende da comparação registrada e completa.'}</p>
      </> : <p>Aguardando a primeira execução administrativa autorizada do ciclo privado de QA.</p>}
    </section>
    <section style={panel} data-testid="r71-study" aria-label="Estudo privado e cobertura">
      <h3 style={{ marginTop: 0 }}>Último estudo e cobertura</h3>
      {study ? <>
        <p>Cobertura completa do snapshot: <strong>{study.metrics.totalRecords} lote(s)</strong> e <strong>{study.metrics.totalEntries} decisão(ões) sintética(s)</strong>, de {date(study.snapshot.period.startMs)} a {date(study.snapshot.period.endMs)}.</p>
        <p>{study.metrics.observationRecords} lote(s) de observação e {study.metrics.validationRecords} lote(s) de validação. Casos de validação não se tornam observações elegíveis para reaplicar a candidata.</p>
        <div style={grid}>
          <p>Contextos de posição não encaminhados pela referência<br/><strong data-testid="r71-study-missed">{study.metrics.baselineMissedExistingPositionRouting}</strong></p>
          <p>Alterações em casos protegidos<br/><strong>{study.metrics.protectedCaseChanges}</strong></p>
        </div>
        <p data-testid="r71-hypothesis">Hipótese: política determinística limitada. Provedor generativo desativado. Gerações elegíveis: {study.hypothesis.eligibleGenerations.length ? study.hypothesis.eligibleGenerations.join(', ') : 'nenhuma'}.</p>
        {study.findings.length ? <ul>{study.findings.map(f => <li key={f.mode}>{f.mode === 'hybrid' ? 'Híbrido' : 'Reverso'}: {f.count} contexto(s) sintético(s) com posição existente não encaminhada.</li>)}</ul> : <p>Nenhuma lacuna elegível foi identificada neste estudo.</p>}
        <details><summary>Referências para auditoria do estudo</summary>
          <p>Snapshot: {study.snapshot.snapshotId}</p><p>Digest do estudo: {study.studyDigest}</p>
          <p>Digest dos membros: {study.snapshot.membershipDigest}</p>
          <p>Congelado em {date(study.snapshot.frozenAtMs)}. O conjunto estudado permanece imutável.</p>
        </details>
      </> : <p>Nenhum estudo foi registrado. Uma observação antiga sem contexto de posição não é enriquecida retroativamente.</p>}
    </section>
    {pending ? <section style={panel} aria-label="Janela registrada de avaliação">
      <h3 style={{ marginTop: 0 }}>Avaliação registrada antes da janela</h3>
      <p data-testid="r71-pending-window">{pending.capturedCases} de {pending.caseCount} casos assinados admitidos entre {date(pending.startsAtMs)} e {date(pending.endsAtMs)}.</p>
      <p>O banco confere o horário real da captura e da admissão. Uma janela incompleta é rejeitada; casos ausentes não são preenchidos depois.</p>
    </section> : null}
    {evaluation ? <section style={panel} data-testid="r71-evaluation" aria-label="Resultado da comparação privada">
      <h3 style={{ marginTop: 0 }}>Última comparação sintética</h3>
      <p><strong>{actions[evaluation.status]}</strong> · {evaluation.summary.observedCases} de {evaluation.summary.expectedCases} casos assinados.</p>
      <div style={grid}>
        <p>Posições existentes sem encaminhamento<br/><strong data-testid="r71-routing-comparison">{metric(evaluation.summary.baselineMissedExistingPositionRouting)} → {metric(evaluation.summary.candidateMissedExistingPositionRouting)}</strong></p>
        <p>Alterações em casos protegidos<br/><strong>{metric(evaluation.summary.protectedCaseChanges)}</strong></p>
        <p>Saídas da candidata fora da política<br/><strong>{metric(evaluation.summary.unsupportedCandidateOutcomes)}</strong></p>
      </div>
      <p>A comparação mede o encaminhamento do contexto sintético. Não representa ganhos, perdas evitadas ou operações reais.</p>
    </section> : null}
    <section style={panel} data-testid="r71-history" aria-label="Histórico da política externa">
      <h3 style={{ marginTop: 0 }}>Histórico preservado</h3>
      {state?.history.length ? <ol style={{ paddingLeft: 22 }}>{state.history.map((h, i) => <li key={`${h.atMs}-${i}`} style={{ marginBottom: 12 }}>
        <strong>{actions[h.action]}</strong> · {date(h.atMs)}<br/>{h.fromVersionId ?? 'Inicialização'} → {h.toVersionId ?? 'Sem alteração'}
      </li>)}</ol> : <p>Nenhuma mudança de política registrada.</p>}
      <p>{feed.snapshots.length} snapshot(s) e {feed.operations.length} operação(ões) recentes disponíveis nesta consulta. Os registros originais e as revisões anteriores são preservados; não há purga física.</p>
    </section>
    <footer style={{ fontSize: 13, color: '#53627c' }}>
      Atualizado em {date(feed.generatedAtMs)}. Host persistente e identidade administrativa hospedada ainda dependem de homologação. Manual conserva o controle do operador; alinhamento, gestão financeira e política UltraFast R65 permanecem separados deste ajuste.
    </footer>
  </section>;
}
