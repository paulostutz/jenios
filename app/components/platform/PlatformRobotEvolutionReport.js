'use client';

const box={background:'#fff',border:'1px solid #ddd6fe',borderRadius:16,padding:20,minWidth:0};
const when=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});

export default function PlatformRobotEvolutionReport({report}) {
  if(!report)return null;
  const changes=report.improvements.period;
  return <section data-testid="evolution-report" aria-label="Relatório de evolução dos robôs" style={{...box,display:'grid',gap:16}}>
    <header><h2 style={{margin:'0 0 8px',fontSize:22}}>Evolução dos robôs</h2>
      <p style={{margin:0,lineHeight:1.6,color:'#475569'}}>Relatório administrativo · evidências sintéticas de pesquisa</p>
    </header>
    <p data-testid="evolution-maturity" style={{margin:0,fontWeight:700,color:'#4c1d95'}}>{report.maturity.label}</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:12}}>
      {[
        ['Observações',report.observations.eventCount,'observations'],
        ['Aplicadas',changes.automaticallyApplied,'applied'],
        ['Rejeitadas',changes.rejected,'rejected'],
        ['Revertidas',changes.rolledBack,'rollback'],
      ].map(([label,value,id])=><article key={id} style={{padding:14,borderRadius:12,background:'#f5f3ff'}}>
        <strong data-testid={`evolution-count-${id}`} style={{fontSize:25,color:'#5b21b6'}}>{value}</strong>
        <div style={{fontSize:13,marginTop:5}}>{label}</div>
      </article>)}
    </div>
    <div data-testid="evolution-version" data-max-age={report.activeVersion.maxAgeMs} style={{padding:15,background:'#f8fafc',borderRadius:12,lineHeight:1.8,overflowWrap:'anywhere'}}>
      <strong>Atualização dos dados do UltraFast · configuração de pesquisa</strong><br/>
      Idade máxima dos dados: {report.activeVersion.maxAgeMs} ms · revisão {report.revision}<br/>
      Melhoria automática restrita aos critérios autorizados e avaliados.
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
      {report.robots.map(robot=><article key={robot.robot} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:12}}>
        <strong>{robot.label}</strong><p style={{fontSize:13,lineHeight:1.5,margin:'8px 0 0'}}>{robot.observations} observações sintéticas · {robot.findings.length} tipos de achado</p>
      </article>)}
    </div>
    <div><h3 style={{fontSize:16,margin:'0 0 10px'}}>Evidências e próximos critérios</h3>
      <ul style={{paddingLeft:20,margin:0,lineHeight:1.7,fontSize:13}}>{report.pending.map(item=><li key={item}>{item}</li>)}</ul>
    </div>
    <p data-testid="evolution-ceiling" style={{margin:0,fontSize:13,lineHeight:1.6}}>O estágio reflete as evidências disponíveis. Não existe percentual comprovado de perfeição ou um máximo de melhoria conhecido.</p>
    <p data-testid="evolution-disclosure" style={{margin:0,fontSize:12,lineHeight:1.7,color:'#475569'}}>Detalhes técnicos ficam no admin. O uso de dados dos clientes e mudanças relevantes no funcionamento exigem transparência.</p>
    <footer style={{fontSize:12,lineHeight:1.8,color:'#475569'}}>
      Período: {when(report.period.startMs)} até {when(report.period.endMs)} (fim exclusivo).<br/>
      Gerado: {when(report.generatedAtMs)} · Brasília.<br/>
      <span data-testid="evolution-schedule">Fechamento diário previsto às 9h. Serviço de produção ainda não ativado.</span><br/>
      <span data-testid="evolution-no-orders">Ordens reais: 0. Paper externo: 0.</span><br/>
      Rentabilidade real, perdas efetivamente evitadas e acurácia real: não medidas.
    </footer>
  </section>;
}
