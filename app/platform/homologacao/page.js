import Link from 'next/link';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Homologação privada • JENIOS Platform',robots:{index:false,follow:false}};
/** B232: preview-only static QA information. No account data, secrets, routes or permissions. */
export default function HomologacaoPage(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.JENIOS_QA_CANDIDATE_ENABLED!=='true')notFound();
 const sections=[
  ['Interface e acesso','Verifique login, recuperação, mobile e isolamento Social/Platform.'],
  ['Comercial','Confirme preços, identidade do pagador e retorno do sandbox. Nenhuma cobrança real liberada.'],
  ['Corretoras','Alpaca Paper e Binance Spot Testnet possuem leitores demonstrativos. Envio de ordens desligado.'],
  ['Robôs e simulação','Os modos direto, reverso e híbrido compartilham risco. Resultado econômico não homologado.'],
  ['Decisão de publicação','Aprovação técnica de CI não dispensa aceite do responsável nem autoriza trading real.']
 ];
 return <main style={{minHeight:'100vh',background:'#0f172a',padding:'clamp(18px,5vw,60px)',color:'#f8fafc',fontFamily:'system-ui'}}>
  <article style={{maxWidth:880,margin:'0 auto'}}>
   <p style={{color:'#c4b5fd',letterSpacing:2,fontSize:12,fontWeight:800}}>JENIOS PLATFORM • PREVIEW RESTRITA</p>
   <h1 style={{fontSize:'clamp(26px,4vw,40px)',marginBottom:12}}>Aceite de homologação</h1>
   <p style={{lineHeight:1.7,color:'#cbd5e1'}}>Esta tela é informativa e só existe quando a homologação está habilitada no ambiente Preview. Não mostra saldos, credenciais, clientes, aprovação bancária ou ordens. A publicação exige revisão humana independente.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16,marginTop:26}}>
    {sections.map(([title,description])=><section key={title} style={{background:'#1e293b',border:'1px solid #475569',padding:20,borderRadius:14}}><h2 style={{fontSize:18,color:'#e9d5ff'}}>{title}</h2><p style={{fontSize:14,lineHeight:1.6}}>{description}</p></section>)}
   </div>
   <p style={{marginTop:28,fontSize:14,color:'#fbbf24'}}>Estado da execução automatizada: NÃO HOMOLOGADA. Custódia pela JENIOS: NÃO.</p>
   <Link href="/integracoes" style={{color:'#c4b5fd',fontWeight:800}}>Ver os guias de corretoras →</Link>
  </article>
 </main>;
}
