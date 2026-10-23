import Link from 'next/link';

export const metadata={title:'Resultados verificados | JENIOS Platform'};

export default function RelatoriosPage(){
 return <main style={{minHeight:'100vh',background:'#0f172a',padding:'32px 16px',fontFamily:'system-ui',color:'#172033'}}>
  <section style={{maxWidth:880,margin:'auto',padding:24,borderRadius:18,background:'#fff'}}>
   <p>JENIOS PLATFORM · RELATÓRIOS</p>
   <h1>Resultados verificados</h1>
   <p role="status">Ainda não há resultados de operações reais verificados para apresentar.</p>
   <p>Ganhos, perdas evitadas e taxa de acerto permanecem sem apuração. O histórico de simulação da sua conta registra decisões fictícias e não comprova desempenho financeiro.</p>
   <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:16,margin:'24px 0'}}>
    {['Resultado financeiro real','Perdas evitadas','Taxa de acerto real'].map(label=><div key={label} style={{background:'#f1f5f9',borderRadius:12,padding:16}}><dt>{label}</dt><dd style={{margin:'8px 0 0',fontWeight:750}}>Não apurado</dd></div>)}
   </dl>
   <p>O extrato PDF ficará disponível quando houver registros verificáveis. Nenhum arquivo foi gerado nesta tela.</p>
   <nav aria-label="Próximos passos" style={{display:'flex',flexWrap:'wrap',gap:18,lineHeight:1.8}}>
    <Link href="/dashboard-logado">Acessar minha conta e simulação</Link>
    <Link href="/platform/assistente">Falar com Gênio ou Gênia</Link>
   </nav>
  </section>
 </main>;
}
