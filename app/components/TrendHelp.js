"use client";
import {useRef} from 'react';
const explanations={
 tokens:['Tendências de busca','Mostra ativos que despertam interesse nas buscas. Popularidade não comprova valorização ou compras de grandes investidores.'],
 megapulse:['MegaPulse · Megatendências','Mostra fechamento e variação diária de mini Ibovespa e mini dólar. Uma variação diária não confirma tendência persistente. Ações e outras classes ainda não estão incluídas.'],
 baleias:['Movimento das baleias','Mostra grandes saídas confirmadas em transações Bitcoin numa amostra do último bloco. Pode incluir troco e transferências entre carteiras da mesma pessoa. Não comprova compra nem identidade institucional.'],
 novos:['Tokens Explosivos','Radar de tokens recentes com compras relevantes e sinais adicionais de volume, liquidez, distribuição e segurança do contrato. Um pool novo não comprova token recém-criado. Os filtros atuais são uma triagem, não confirmação de compras de baleias ou previsão de retorno.']
};
export default function TrendHelp({kind}) {
 const ref=useRef(null);const [title,text]=explanations[kind]||explanations.tokens;
 return <span><button type="button" aria-label={'Entender '+title} onClick={e=>{e.preventDefault();e.stopPropagation();ref.current?.showModal();}} style={{marginLeft:8,width:24,height:24,border:'1px solid #a78bfa',borderRadius:'50%',background:'#fff',color:'#6d28d9',cursor:'pointer',fontWeight:700}}>?</button><dialog ref={ref} onClick={e=>e.stopPropagation()} aria-label={title} style={{maxWidth:440,width:'calc(100% - 48px)',padding:24,border:'1px solid #ddd6fe',borderRadius:16,color:'#24354e'}}><h3>{title}</h3><p style={{lineHeight:1.6,fontSize:14}}>{text}</p><form method="dialog"><button style={{padding:'9px 18px',border:0,borderRadius:8,background:'#7c3aed',color:'white'}}>Fechar</button></form></dialog></span>;
}
