'use client';
import useTrendsData from './useTrendsData';
import TrendHelp from './TrendHelp';
import { useEffect, useState } from 'react';
const usd = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
export default function NewTokenRadar({compact=false}) {
  const {data,error}=useTrendsData('/api/tendencias/tokens-novos');
  return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:compact?10:20,minWidth:0,fontSize:compact?12:undefined}}>
    <h3 style={{margin:'0 0 8px'}}>Tokens Explosivos — observação<TrendHelp kind="novos"/></h3>
    <p style={{fontSize:12,color:'#475569'}}>Acompanhe tokens e pools recentes em observação.</p>
    <p style={{fontSize:12,color:'#92400e'}}>Pool novo não comprova token recém-criado. Criação do token e compras institucionais ainda não confirmadas; estes candidatos não atendem, sozinhos, à definição completa de token explosivo.</p>
    <div aria-live="polite">
      {error&&<p role="status">Atualização indisponível; os dados exibidos são da última consulta.</p>}
      {!data ? <p>Consultando pools recentes…</p> : !data.disponivel ? <p>{data.mensagem}</p> : !data.candidatos?.length ? <p>Nenhum token em destaque nesta atualização.</p> : data.candidatos.slice(0,compact?2:10).map(item => <article key={item.id} style={{padding:12,marginBottom:8,background:'#f8fafc',borderRadius:10,overflowWrap:'anywhere'}}>
        <a href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.nome} ({item.simbolo})</strong></a>
        <p style={{fontSize:12}}>Rede: {item.rede} · Pool criado em {new Date(item.poolCriadoEm).toLocaleString('pt-BR')}</p>
        <p style={{fontSize:12}}>Liquidez {usd(item.liquidezUsd)} · Volume/1h {usd(item.volumeH1Usd)} · Alta/1h {item.variacaoH1.toFixed(1)}%</p>
        <p style={{fontSize:12}}>{item.comprasH1} compras / {item.vendasH1} vendas · {item.compradoresH1} compradores · {(item.proporcaoCompras*100).toFixed(0)}% das transações são compras</p>
        <small>Contrato: {item.contrato}. Identidade institucional não verificada.</small>
      </article>)}
    </div>
    {!compact&&<p style={{fontSize:11,color:'#64748b'}}>Não verifica honeypot, concentração, bloqueio de liquidez ou volume artificial e não estima retorno.</p>}
  </section>;
}
