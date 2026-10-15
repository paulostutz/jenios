"use client";
import {useRef} from 'react';
const explanations={
 tokens:['Tendências de busca','Mostra ativos que despertam interesse nas buscas. Popularidade não comprova valorização ou compras de grandes investidores.'],
 megapulse:['MegaPulse · Megatendências','Mostra cotações de ações B3 monitoradas somente quando o horário da negociação tem até 2 minutos. A variação exibida é do pregão. Fechamentos diários e cotações antigas não são exibidos como movimentos atuais. Futuros dependem de uma leitura intradiária verificável.'],
 baleias:['Movimento das baleias','Mostra grandes saídas confirmadas em transações Bitcoin numa amostra de blocos recentes. Sem movimento encontrado nos últimos 15 minutos, mostra os três últimos registrados com data e horário, identificados como histórico. Pode incluir troco e transferências entre carteiras da mesma pessoa. Não comprova compra nem identidade institucional.'],
 novos:['Tokens Explosivos','Radar de pools recentes filtrados por volume, liquidez e atividade de compras. Um pool novo não comprova token recém-criado. Os filtros atuais são uma triagem, não confirmação de compras de baleias ou previsão de retorno.']
};
export default function TrendHelp({kind}) {
 const ref=useRef(null);const [title,text]=explanations[kind]||explanations.tokens;
 return <span><button type="button" aria-label={'Entender '+title} onClick={e=>{e.preventDefault();e.stopPropagation();ref.current?.showModal();}} style={{marginLeft:8,width:24,height:24,border:'1px solid #a78bfa',borderRadius:'50%',background:'#fff',color:'#6d28d9',cursor:'pointer',fontWeight:700}}>?</button><dialog ref={ref} onClick={e=>e.stopPropagation()} aria-label={title} style={{maxWidth:440,width:'calc(100% - 48px)',padding:24,border:'1px solid #ddd6fe',borderRadius:16,color:'#24354e'}}><h3>{title}</h3><p style={{lineHeight:1.6,fontSize:14}}>{text}</p><form method="dialog"><button style={{padding:'9px 18px',border:0,borderRadius:8,background:'#7c3aed',color:'white'}}>Fechar</button></form></dialog></span>;
}
