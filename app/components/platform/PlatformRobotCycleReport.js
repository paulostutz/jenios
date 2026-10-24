import {requireR65AdminFeed} from '../../../lib/platform/research/robot-r65-admin-view.mjs';

const panel={padding:18,border:'1px solid #ddd6fe',borderRadius:14,background:'#fff',minWidth:0};
const labels={BASELINE:'Configuração de referência',EVALUATING:'Avaliação em andamento',QA_APPLIED:'Melhoria aplicada em QA',QA_ROLLED_BACK:'Configuração anterior restaurada'};
const actions={EVALUATION_REGISTERED:'Avaliação registrada',AUTO_APPLIED:'Melhoria aplicada em QA',REJECTED:'Candidata recusada',ROLLED_BACK:'Reversão concluída'};
const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});

export default function PlatformRobotCycleReport({feed}){
  requireR65AdminFeed(feed);
  const state=feed.state,evaluation=state?.lastEvaluation,pending=state?.pendingEvaluation;
  return <section data-testid="r65-cycle-report" aria-label="Ciclo de evolução dos robôs em QA" style={{display:'grid',gap:16,minWidth:0,color:'#211b39',overflowWrap:'anywhere'}}>
    <header style={{...panel,background:'#f5f3ff'}}>
      <p style={{fontWeight:700,color:'#6d28d9',margin:'0 0 8px'}}>Homologação · ciclo R65</p>
      <h2 style={{fontSize:24,margin:'0 0 12px'}}>Evolução com avaliação e histórico</h2>
      <p data-testid="r65-provenance">Observações assinadas de execuções sintéticas dos quatro robôs. A candidata é comparada com a configuração anterior em uma bateria sintética registrada antes da execução.</p>
      <p data-testid="r65-no-orders">Ordens reais: 0 · Paper externo: 0 · Monitoramento de clientes: inativo.</p>
      <p style={{marginBottom:0}}>O motor proprietário externo ainda precisa de integração e homologação. Estes resultados não certificam rentabilidade nem precisão em operações reais.</p>
    </header>
    <section style={panel} aria-labelledby="r65-version-title">
      <h3 id="r65-version-title" style={{marginTop:0}}>Configuração ativa</h3>
      {state?<>
        <p data-testid="r65-maturity"><strong>{labels[state.maturity]}</strong></p>
        <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16,marginBottom:0}}>
          <div><dt>Versão</dt><dd data-testid="r65-active-version" style={{margin:0,fontWeight:700}}>{state.activeVersion.versionId}</dd></div>
          <div><dt>Validade máxima da leitura</dt><dd data-testid="r65-active-age" style={{margin:0,fontWeight:700}}>{state.activeVersion.maxAgeMs} ms</dd></div>
          <div><dt>Geração de ativação</dt><dd data-testid="r65-generation" style={{margin:0,fontWeight:700}}>{state.activeVersion.activationGeneration}</dd></div>
        </dl>
        {pending?<p role="status">Avaliação registrada: {pending.capturedCases} de {pending.caseCount} casos capturados entre {date(pending.startsAtMs)} e {date(pending.endsAtMs)}. Casos ausentes não são preenchidos depois da janela.</p>:null}
      </>:<p>Aguardando a primeira execução autorizada do ciclo de QA.</p>}
    </section>
    {evaluation?<section style={panel} aria-label="Resultado da última comparação">
      <h3 style={{marginTop:0}}>Última comparação sintética</h3>
      <p>{actions[evaluation.status]} · {evaluation.validationCases} casos executados.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        <p>Liberações indevidas<br/><strong>{evaluation.baselineFalseAllows??'Não avaliado'} → {evaluation.candidateFalseAllows??'Não avaliado'}</strong></p>
        <p>Bloqueios indevidos<br/><strong>{evaluation.baselineFalseBlocks??'Não avaliado'} → {evaluation.candidateFalseBlocks??'Não avaliado'}</strong></p>
      </div>
      <p>A seta compara referência e candidata nesta bateria. Não representa ganhos financeiros.</p>
    </section>:null}
    <section style={panel} data-testid="r65-history" aria-label="Histórico de versões">
      <h3 style={{marginTop:0}}>Histórico de versões</h3>
      {state?.history.length?<ol style={{paddingLeft:22,marginBottom:0}}>{state.history.map((entry,index)=><li key={`${entry.atMs}-${index}`} style={{marginBottom:12}}>
        <strong>{actions[entry.action]}</strong> · {date(entry.atMs)}<br/>{entry.fromVersionId??'Inicialização'} → {entry.toVersionId??'Sem alteração'}
      </li>)}</ol>:<p>Nenhuma alteração registrada.</p>}
    </section>
    <section style={panel} data-testid="r65-archives" aria-label="Arquivamento verificável">
      <h3 style={{marginTop:0}}>Arquivamento verificável</h3>
      <p>{feed.archives.filter(x=>x.status==='COMMITTED').length} arquivo(s) confirmado(s); {feed.archives.filter(x=>x.status==='PREVIEW').length} prévia(s).</p>
      <p>Os arquivos preservam cópias verificáveis. Os registros originais continuam disponíveis para auditoria e proteção contra repetição. Espaço liberado: 0 bytes.</p>
    </section>
    <section style={panel} data-testid="r65-reconciliations" aria-label="Reconciliação de custos">
      <h3 style={{marginTop:0}}>Reconciliação de custos</h3>
      <p>{feed.reconciliations.length} reconciliação(ões) registrada(s) · {feed.pendingReconciliations.length} pendência(s).</p>
      <p>Chamadas com resultado incerto aguardam evidência administrativa. A reconciliação preserva o registro original e mantém a geração paga desativada.</p>
    </section>
    <footer style={{fontSize:13,color:'#655d75'}}>Atualizado em {date(feed.generatedAtMs)}. Manual permanece sob controle do operador; Híbrido e Reverso preservam o limite de alinhamento de 0,65. Losseshômetro exclusivamente hipotético.</footer>
  </section>;
}
