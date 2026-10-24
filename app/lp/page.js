'use client';
import {PlatformPurpose,PlatformEducationalQuiz,PlatformFAQ} from '../components/PlatformPresentation';
import {BrandLockup,BrandFooter} from '../components/brand/BrandSignature';

export default function LandingPagePro() {
 return (
    <main className="jenios-lp" id="lp-inicio" style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div className="lp-content" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* CABEÇALHO */}
        <header className="lp-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#0f172a', padding: '16px 24px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{display:'grid',gap:3}}>
              <BrandLockup tone="light" priority/>
              <span style={{fontSize:9,color:'#556683',fontWeight:750,letterSpacing:'.055em'}}>MENOS IMPULSO. MAIS MÉTODO.</span>
            </div>
          </div>
          <nav className="lp-header-actions" aria-label="Acessos JENIOS" style={{ display: 'flex', gap: '10px' }}>
            <a href="/" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>← Voltar ao Portal</a>
            <a href="/social" className="lp-social-link">Entrar na Social</a>
            <a href="/dashboard-logado" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>Acessar a Platform</a>
          </nav>
        </header>

        <p style={{margin:0,textAlign:'center',color:'#c4b5fd',fontSize:12}}>Pré-lançamento técnico · análises em teste · execução real ainda não liberada</p>
        {/* HERO SECTION */}
        <div className="lp-hero" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', margin: 0, lineHeight: '1.2' }}>
            Sua próxima decisão merece mais método e menos impulso. <span style={{ color: '#a78bfa' }}>A JENIOS começa por você.</span>
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '780px', margin: '0 auto', lineHeight: '1.6' }}>
            Estude o mercado, pratique com saldo fictício e registre suas decisões no mesmo ecossistema. A JENIOS reúne Social, Universidade e Platform para ajudar você a reconhecer padrões, testar hipóteses e construir uma rotina com limites claros.
          </p>
          <div style={{display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
            <a href="/platform/entrar?next=%2Fdashboard" style={{padding:'13px 20px',borderRadius:10,background:'#7c3aed',color:'#fff',textDecoration:'none',fontWeight:800}}>Começar pelo simulador</a>
            <a href="#jenios-plans" style={{padding:'13px 20px',borderRadius:10,border:'1px solid #a78bfa',color:'#e9d5ff',textDecoration:'none',fontWeight:700}}>Comparar planos</a>
          </div>
          <small style={{color:'#94a3b8'}}>Entre com a mesma conta da Social. O simulador usa valores fictícios.</small>
        </div>

        <nav className="lp-section-nav" aria-label="Nesta página"><a href="#jenios-purpose">Propósito</a><a href="#jenios-modes">Os três modos</a><a href="#jenios-quiz">Conheça seu processo</a><a href="#jenios-plans">Planos</a><a href="#jenios-faq">Dúvidas</a></nav>

        {/* BANNER DE DESTAQUE: CLAREZA ANTES DO CLIQUE */}
        <div className="lp-purpose-banner" style={{ backgroundColor: '#1e1b4b', border: '3px solid #7c3aed', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.4)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '6px 12px', borderRadius: '6px', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>
              NOSSO PROPÓSITO
            </span>
            <span style={{ fontSize: '13px', color: '#c084fc', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '2px' }}>
              CLAREZA ANTES DO CLIQUE
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', margin: 0, lineHeight: '1.4' }}>
            O mercado não precisa de mais um clique impulsivo. Você precisa de um processo melhor.
          </h2>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
            Entrar sem um plano, mudar de estratégia a cada movimento e aumentar a exposição depois de uma perda dificultam a avaliação do seu processo. Na JENIOS, você pode praticar decisões, definir limites fictícios e revisar o que registrou antes de assumir risco real.
          </p>
        </div>

        {/* CAIXAS SEPARADAS (TAKES DE CONVENCIMENTO) */}
        <div className="lp-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>O DESAFIO</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>Entenda o que motivou cada decisão</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Use gráficos para estudar o contexto e um diário de intenções para revisar suas escolhas. O objetivo é tornar o seu processo visível, sem tratar uma simulação como resultado real.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>O MÉTODO</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>Teste uma hipótese antes de adotá-la</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                O modo reverso é uma hipótese a testar com custos e histórico comparável. Quando a decisão está alinhada a uma tendência consistente, não faz sentido contrariá-la mecanicamente.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>A PROPOSTA JENIOS</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>Construa uma rotina com limites claros</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Manual, reverso e híbrido: três formas de estudar a decisão, com contexto, regras de entrada e saída e controle de risco. Recursos em homologação; sem promessa de lucro automático.
              </p>
            </div>
          </div>
        </div>

        <PlatformPurpose />
        <PlatformEducationalQuiz />

        {/* SEÇÃO DOS PLANOS OFICIAIS NO FINAL DA PÁGINA (TECNOLOGIA EMBARCADA & ATIVOS DIFERENCIADOS) */}
        <section id="jenios-plans" aria-labelledby="jenios-plans-title" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>JENIOS PLATFORM</span>
            <h2 id="jenios-plans-title" style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0' }}>Escolha o alcance da sua experiência</h2>
          </div>

          <div className="lp-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
            
            {/* Starter - R$ 99,90 */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>NACIONAL — B3</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 99,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Escopo previsto: mercado brasileiro, com mini-índice, mini-dólar e ações. Execução condicionada às integrações e à homologação.</p>
              </div>
              <a href="/checkout" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#7c3aed', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Ver disponibilidade — Nacional</a>
            </div>

            {/* Trader Pro - R$ 149,90 (Cripto) */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '2px solid #7c3aed', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-10px', right: '16px', backgroundColor: '#7c3aed', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>B3 + CRIPTO</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>GLOBAL CRYPTO</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 149,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Escopo previsto: recursos do plano Nacional mais criptoativos. Dados, permissões e custos variam por mercado e corretora.</p>
              </div>
              <a href="/checkout" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#7c3aed', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Ver disponibilidade — Global Crypto</a>
            </div>

            {/* Institucional HFT - R$ 199,90 (Global) */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>INTERNACIONAL PRO</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 199,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Escopo previsto: mercados internacionais elegíveis, além de B3 e cripto. A disponibilidade depende do provedor, da corretora e da jurisdição.</p>
              </div>
              <a href="/checkout" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#334155', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Ver disponibilidade — Internacional Pro</a>
            </div>

          </div>
        </section>

        <p style={{fontSize:12,color:'#94a3b8',margin:0}}>Valores mensais previstos. Consulte no checkout o que está efetivamente disponível antes de contratar. Custos da corretora, dados, tributos e operações não estão incluídos. Assinatura não é garantia de retorno.</p>
        <PlatformFAQ />
        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '30px' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>{PLATFORM_SLOGAN}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Estudo e simulação ajudam a revisar decisões, mas não garantem resultado financeiro. Operações podem gerar perdas.</div>
          <BrandFooter tone="dark" scope="Platform"/>
        </div>

      </div>
    </main>
  );
}