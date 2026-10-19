'use client';
import {PLATFORM_LAUNCH_GATES} from '../../../lib/platform/release-readiness.mjs';
/** Render only under PlatformAdminAccess permission=platform.admin. */
export default function PlatformResearchReadiness(){
 return <section aria-label="Certificação do laboratório" style={{background:'#fff',padding:20,borderRadius:14,border:'1px solid #e2e8f0'}}>
  <h2 style={{fontSize:18,margin:'0 0 10px'}}>Certificação da tecnologia JENIOS Platform</h2>
  <p style={{fontSize:12,color:'#475569',lineHeight:1.6}}>Os núcleos originais foram recuperados e testados em ambiente privado, mas ainda não foram instalados neste runtime público. Os roteiros apresentados na Mesa permanecem simulações ilustrativas.</p>
  <div style={{display:'grid',gap:9}}>
   {PLATFORM_LAUNCH_GATES.map(item=><article key={item.id} style={{border:'1px solid #e9d5ff',background:'#faf9ff',borderRadius:10,padding:12,fontSize:12}}>
    <strong>{item.id} · {item.name}</strong>
    <p style={{margin:'6px 0',color:'#92400e'}}>Próxima prova necessária: {item.needs}</p>
   </article>)}
  </div>
  <p role="note" style={{fontSize:11,color:'#991b1b'}}>Acesso a contas reais, assinaturas, ordens e previsão de rentabilidade não são liberados por este painel.</p>
 </section>;
}
