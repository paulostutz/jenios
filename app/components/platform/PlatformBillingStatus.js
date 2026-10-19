'use client';
import Link from 'next/link';

/**
 * A JENIOS PAY tem identidade de cobrança própria. Enquanto o vínculo entre
 * assinante da Platform e conta pagadora não for homologado, NÃO mostramos
 * pedidos da Social como se pertencessem a esta sessão da Platform.
 */
export default function PlatformBillingStatus(){
 return <section role="status" style={{background:'#f8fafc',border:'1px solid #e2e8f0',padding:'18px 20px',borderRadius:12,lineHeight:1.7}}>
  <h3 style={{fontSize:16,color:'#0f172a',margin:'0 0 8px'}}>Assinatura da JENIOS Platform</h3>
  <p style={{fontSize:13,color:'#475569',margin:0}}>A consulta de assinaturas e pagamentos desta conta aguarda o vínculo autenticado com a JENIOS PAY. O extrato da Social não é utilizado como extrato da Platform.</p>
  <p style={{fontSize:12,color:'#92400e',margin:'12px 0 0'}}>Nenhuma cobrança foi solicitada nesta tela. Não interpretamos ausência de dados como assinatura paga, gratuita ou cancelada.</p>
  <p style={{fontSize:12,margin:'12px 0 0'}}><Link href="/dashboard" style={{color:'#6d28d9',fontWeight:800}}>Continuar na simulação →</Link></p>
 </section>;
}
