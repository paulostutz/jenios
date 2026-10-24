'use client';
import Link from 'next/link';
import {useState} from 'react';
import {createR63FixtureInput,runR63FixtureCycle} from '../../../lib/platform/research/robot-r63-fixture-cycle.mjs';
import {rollbackR63Evolution,evaluateR63ActiveFreshness} from '../../../lib/platform/research/robot-r63-continuous-evolution.mjs';
import {buildR63AdminReport} from '../../../lib/platform/research/robot-r63-admin-report.mjs';
import PlatformRobotEvolutionReport from './PlatformRobotEvolutionReport';

const button={border:0,borderRadius:10,background:'#5b21b6',color:'#fff',padding:'12px 16px',fontWeight:700,cursor:'pointer'};

export default function PlatformRobotEvolutionPreview(){
  const [scenario,setScenario]=useState('improve'),[cycle,setCycle]=useState(null),[error,setError]=useState('');
  function run(){
    setError('');setCycle(null);
    try{setCycle(runR63FixtureCycle(createR63FixtureInput({scenario})));}
    catch{setError('O ciclo não pôde ser validado. Nenhuma nova versão foi presumida.');}
  }
  function rollback(){
    if(!cycle)return;
    try{
      const evolution=rollbackR63Evolution({state:cycle.evolution,reason:'REGRESSION_DETECTED',nowMs:cycle.evolution.updatedAtMs+1000});
      const report=buildR63AdminReport({study:cycle.study,evolution,period:cycle.report.period,generatedAtMs:cycle.report.generatedAtMs});
      setCycle({...cycle,evolution,report,after:evaluateR63ActiveFreshness({state:evolution,snapshotAgesMs:[650,650]})});
      setError('');
    }catch{setError('A reversão não foi validada. O histórico anterior foi preservado.');}
  }
  return <main style={{minHeight:'100vh',padding:'clamp(16px,4vw,40px)',background:'#f2f4fa',color:'#17213b',fontFamily:'system-ui'}}>
    <div style={{maxWidth:1050,margin:'0 auto',display:'grid',gap:20,minWidth:0}}>
      <nav><Link href="/platform/homologacao/robos">← Homologação dos robôs</Link></nav>
      <header style={{background:'#211c46',color:'#fff',padding:25,borderRadius:18}}>
        <p style={{fontSize:12,letterSpacing:1.5}}>JENIOS PLATFORM · PESQUISA</p>
        <h1 style={{fontSize:'clamp(24px,4vw,36px)'}}>Observação e melhoria contínua</h1>
        <p style={{lineHeight:1.7}}>Prévia administrativa com dados fictícios. O ciclo usa observações, avaliação independente e aplicação automática de uma configuração de pesquisa.</p>
        <p style={{fontSize:13,lineHeight:1.7}}>Esta tela não acessa clientes ou corretoras, não chama a IA paga e não inicia um serviço em produção.</p>
      </header>
      <section aria-label="Executar cenário sintético" style={{background:'#fff',padding:20,borderRadius:16,display:'grid',gap:16,minWidth:0}}>
        <label style={{display:'grid',gap:8,fontWeight:700}}>Cenário de verificação
          <select data-testid="evolution-scenario" value={scenario} onChange={event=>{setScenario(event.target.value);setCycle(null);setError('');}} style={{maxWidth:'100%',width:'100%',padding:12,border:'1px solid #cbd5e1',borderRadius:8,fontSize:14}}>
            <option value="improve">Melhoria confirmada no conjunto sintético</option>
            <option value="regression">Candidata provoca regressão</option>
            <option value="insufficient">Evidência insuficiente</option>
            <option value="control_violation">Violação do controle do operador</option>
          </select>
        </label>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          <button data-testid="evolution-run" type="button" style={button} onClick={run}>Executar ciclo sintético</button>
          <button data-testid="evolution-rollback" type="button" style={{...button,background:'#475569',opacity:cycle?.report.activeVersion.maxAgeMs===500?1:.5}} onClick={rollback} disabled={cycle?.report.activeVersion.maxAgeMs!==500}>Reverter configuração de pesquisa</button>
        </div>
        {error?<p role="alert">{error}</p>:null}
        {!cycle?<p data-testid="evolution-empty" style={{margin:0,color:'#64748b'}}>Nenhuma avaliação desta sessão foi executada.</p>:null}
      </section>
      {cycle?<>
        <section data-testid="evolution-comparison" style={{background:'#fff',padding:20,borderRadius:16,lineHeight:1.8}}>
          <h2 style={{margin:'0 0 10px',fontSize:19}}>Aplicação observável da versão</h2>
          <p style={{margin:0}}>Para dois dados sintéticos com idade de 650 ms:</p>
          <p data-testid="evolution-before" data-allow={String(cycle.before.allow)} style={{margin:'6px 0'}}>Antes: {cycle.before.allow?'decisão sintética permitida':'decisão sintética bloqueada'}.</p>
          <p data-testid="evolution-after" data-allow={String(cycle.after.allow)} style={{margin:'6px 0'}}>Configuração vigente: {cycle.after.allow?'decisão sintética permitida':'decisão sintética bloqueada'}.</p>
          <p style={{fontSize:12,margin:'8px 0 0'}}>O teste avalia o controle de atualização dos dados; não mede retorno financeiro.</p>
        </section>
        <PlatformRobotEvolutionReport report={cycle.report}/>
      </>:null}
    </div>
  </main>;
}
