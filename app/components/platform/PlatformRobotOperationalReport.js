'use client';
import {isR64OperationalReport} from '../../../lib/platform/research/robot-r64-admin-view.mjs';
const names={manual:'Manual',hybrid:'Híbrido',reverse:'Reverso',ultrafast:'UltraFast'};
const when=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
const issueNames={STALE_CONTEXT:'Dados desatualizados',SEQUENCE_GAP:'Lacuna na sequência',
  CONNECTION_FAILURE:'Falha de conexão',CONTROL_VIOLATION:'Violação do controle do operador'};

export default function PlatformRobotOperationalReport({report}){
  if(!isR64OperationalReport(report))return <p role="alert">Relatório indisponível. Nenhum resultado foi presumido.</p>;
  const audit=report.providerAudit;
  const providerLabel=audit.kind==='unknown'?'Reconciliação necessária':audit.analysisStatus==='VALID'?
    'Hipóteses registradas':audit.kind==='usage_confirmed'?'Uso registrado; hipótese não admitida':'Análise generativa não executada';
  return <section data-testid="r64-report" aria-label="Relatório de observação dos robôs" style={{background:'#fff',border:'1px solid #ddd6fe',borderRadius:16,padding:20,display:'grid',gap:16,minWidth:0,overflowWrap:'anywhere'}}>
    <header><h2 style={{margin:'0 0 8px',fontSize:22}}>Observação dos robôs</h2>
      <p data-testid="r64-evidence-kind" style={{margin:0,color:'#475569',lineHeight:1.6}}>Replay de QA com assinatura verificada da origem configurada. Não representa operações reais de clientes.</p></header>
    <strong data-testid="r64-maturity" style={{color:'#4c1d95'}}>{report.maturity.label}</strong>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>
      {[['Observações',report.observations.eventCount,'r64-observation-count'],
        ['Ocorrências',report.observations.incidentCount,'r64-incident-count'],
        ['Mudanças aplicadas',report.autonomousChangesApplied,'r64-applied-count']].map(([name,value,id])=>
        <article key={id} style={{background:'#f5f3ff',padding:14,borderRadius:12}}><strong data-testid={id} style={{fontSize:25,color:'#5b21b6'}}>{value}</strong><div style={{fontSize:13,marginTop:5}}>{name}</div></article>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10}}>
      {Object.entries(names).map(([robot,label])=><article key={robot} style={{border:'1px solid #e2e8f0',padding:12,borderRadius:10}}>
        <strong>{label}</strong><p style={{margin:'8px 0 0',fontSize:13}}>{report.observations.byRobot[robot]} {report.observations.byRobot[robot]===1?'observação':'observações'} de QA</p></article>)}
    </div>
    <div style={{background:'#f8fafc',padding:15,borderRadius:12,lineHeight:1.7}}>
      <strong data-testid="r64-provider-status">{providerLabel}</strong>
      <p style={{margin:'8px 0 0',fontSize:13}}>Tentativas de inferência: {audit.inferenceRequests}. Requisições de transporte: {audit.httpRequests}.</p>
      {audit.model?<p style={{margin:'8px 0 0',fontSize:13}}>Modelo: {audit.model}. Custo contabilizado pela tarifa aprovada: {audit.costNanoUsd===null?'aguardando confirmação':`US$ ${(audit.costNanoUsd/1e9).toFixed(6)}`}.</p>:null}
      <p style={{margin:'8px 0 0',fontSize:13}}>As hipóteses deste relatório não alteram os robôs. A avaliação automática sintética R63 permanece separada.</p>
      {report.hypotheses?.proposals.length?<p style={{margin:'8px 0 0',fontSize:13}}>Hipótese registrada: avaliar limite de atualização dos dados de 500 ms. A mudança depende de avaliação independente; não foi aplicada por este fluxo.</p>:null}
    </div>
    {report.findings.length?<div><h3 style={{fontSize:16,margin:'0 0 8px'}}>Ocorrências observadas</h3>
      <ul style={{paddingLeft:20,margin:0,lineHeight:1.7,fontSize:13}}>{report.findings.map(f=>
        <li key={f.robot+f.code}>{names[f.robot]}: {issueNames[f.code]||'Ocorrência de QA'} · {f.eventCount}</li>)}</ul></div>:null}
    <p style={{fontSize:13,lineHeight:1.6,margin:0}}>O estágio indica evidências disponíveis. Não há percentual comprovado de perfeição ou rentabilidade.</p>
    <p data-testid="r64-disclosure" style={{fontSize:12,lineHeight:1.7,margin:0,color:'#475569'}}>Detalhes técnicos ficam no admin. O uso de dados de clientes e mudanças relevantes no funcionamento exigem transparência. A assinatura do coletor não comprova consentimento independente ou atividade da corretora.</p>
    <footer style={{fontSize:12,lineHeight:1.8,color:'#475569'}}>
      <span data-testid="r64-scope">Escopo de QA: {report.scopeId}</span><br/>
      Período: {when(report.period.startMs)} até {when(report.period.endMs)} (fim exclusivo).<br/>
      Registrado: {when(report.generatedAtMs)} · Brasília.<br/>
      <span data-testid="r64-schedule">Fechamento diário às 9h preparado. Agendador de produção não ativado.</span><br/>
      <span data-testid="r64-no-orders">Ordens reais: 0. Paper externo: 0.</span>
    </footer>
  </section>;
}
