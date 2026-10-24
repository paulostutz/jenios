'use client';
import InterSetupForm from './InterSetupForm';

export default function InterAdminPanel(){
 return <section style={{background:'#fff',padding:22,border:'1px solid #cbd5e1',borderRadius:16,margin:'20px 0'}}>
  <h2 style={{margin:'0 0 8px'}}>Banco Inter da JENIOS</h2>
  <p style={{fontSize:14,color:'#475569',lineHeight:1.6}}>Cadastre a integração Pix e confira a conexão da conta recebedora. Somente o Master autorizado pode configurar ou testar.</p>
  <InterSetupForm/>
 </section>;
}
