const cash=x=>x==null?'Não disponível':Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const period=p=>String(p).slice(4)+'/'+String(p).slice(0,4);
export default function BankscoreFinancialAppendix({data}) {
  if(!data)return null;
  if(!data.available)return <section><h3>Balanços e evolução trimestral</h3><p>{data.reason}</p></section>;
  return <section style={{borderTop:'1px solid #ddd',marginTop:24,paddingTop:16}}>
    <h3>{data.title}</h3><p>{data.scope}. Valores em reais. Base coletada em {new Date(data.snapshotAt).toLocaleDateString('pt-BR')}.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><caption style={{textAlign:'left'}}>Períodos disponíveis até a data-base contratada</caption><thead><tr><th style={{textAlign:'left',padding:8}}>Indicador</th>{data.rows.map(r=><th key={r.period} style={{padding:8}}>{period(r.period)}</th>)}</tr></thead><tbody>{Object.entries(data.labels).map(([key,label])=><tr key={key}><th scope="row" style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>{label}</th>{data.rows.map(r=><td key={r.period} style={{padding:8,textAlign:'right',whiteSpace:'nowrap',borderBottom:'1px solid #eee'}}>{cash(r.values[key])}</td>)}</tr>)}</tbody></table></div>
    <h4>Leitura da evolução</h4>{data.observations.map(x=><p key={x}>{x}</p>)}
    {data.comparable&&<p>Variação do patrimônio líquido ante o período anterior: {cash(data.changes.equity?.absolute)}{data.changes.equity?.percent!=null?' ('+data.changes.equity.percent.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%)':''}.</p>}
    <h4>Parecer sobre a cobertura</h4><p>{data.assessment}</p><ul>{data.missing.map(x=><li key={x}>{x}</li>)}</ul>
    <h4>Entenda os números</h4>{Object.entries(data.guide).map(([key,text])=><p key={key}>{text}</p>)}
    <details><summary>Fontes, datas e limites da comparação</summary><p><a href={data.catalogueUrl} target="_blank" rel="noreferrer">Catálogo oficial do Banco Central</a></p>{data.rows.map(r=><div key={r.period}><p>{period(r.period)} · Geração do relatório: {r.generationDate||'Não disponível'}</p>{r.notes.map(x=><p key={x}>{x}</p>)}{r.sources?.map((s,i)=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">Arquivo oficial {i+1}</a></p>)}</div>)}{data.limitations.map(x=><p key={x}>{x}</p>)}</details>
  </section>;
}
