'use client';
import { useEffect, useState } from 'react';
const usd = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
export default function NewTokenRadar() {
  const [data,setData] = useState(null);
  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const response = await fetch('/api/tendencias/tokens-novos', {cache:'no-store',signal:controller.signal});
        if (!response.ok) throw Error();
        const payload = await response.json();
        if (active) setData(payload);
      } catch { if (active) setData({disponivel:false,candidatos:[],mensagem:'Fonte indisponível nesta consulta.'}); }
      finally { busy = false; }
    }
    refresh(); const timer = setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return () => {active=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:20,minWidth:0}}>
    <h3 style={{margin:'0 0 8px'}}>Tokens Explosivos — observação</h3>
    <p style={{fontSize:12,color:'#475569'}}>Pré-seleção por pools de 15 minutos a 48 horas, liquidez ≥ US$25 mil, volume de 1h ≥ US$50 mil, ≥100 compras, ≥50 compradores, ≥60% de compras e alta de 1h ≥5%. Exclui ativos catalogados e símbolos de moedas consolidadas. Volume/liquidez máximo: 20×.</p>
    <p style={{fontSize:12,color:'#92400e'}}>Pool novo não comprova token recém-criado. Criação do token e compras institucionais ainda não confirmadas; estes candidatos não atendem, sozinhos, à definição completa de token explosivo.</p>
    <div aria-live="polite">
      {!data ? <p>Consultando pools recentes…</p> : !data.disponivel ? <p>{data.mensagem}</p> : !data.candidatos?.length ? <p>Nenhum candidato atende aos filtros nesta amostra. A lista não será preenchida com moedas antigas.</p> : data.candidatos.map(item => <article key={item.id} style={{padding:12,marginBottom:8,background:'#f8fafc',borderRadius:10,overflowWrap:'anywhere'}}>
        <a href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.nome} ({item.simbolo})</strong></a>
        <p style={{fontSize:12}}>Rede: {item.rede} · Pool criado em {new Date(item.poolCriadoEm).toLocaleString('pt-BR')}</p>
        <p style={{fontSize:12}}>Liquidez {usd(item.liquidezUsd)} · Volume/1h {usd(item.volumeH1Usd)} · Alta/1h {item.variacaoH1.toFixed(1)}%</p>
        <p style={{fontSize:12}}>{item.comprasH1} compras / {item.vendasH1} vendas · {item.compradoresH1} compradores · {(item.proporcaoCompras*100).toFixed(0)}% das transações são compras</p>
        <small>Contrato: {item.contrato}. Identidade institucional não verificada.</small>
      </article>)}
    </div>
    <p style={{fontSize:11,color:'#64748b'}}>Fonte: GeckoTerminal/CoinGecko. {data?.cobertura} {data?.disponivel && data.atualizadoEm ? `Última consulta válida: ${new Date(data.atualizadoEm).toLocaleString('pt-BR')}.` : ''} Cache de 5 minutos por processo. Critérios de triagem internos, sem validação preditiva. Não verifica honeypot, concentração, bloqueio de liquidez ou volume artificial e não estima retorno.</p>
  </section>;
}
