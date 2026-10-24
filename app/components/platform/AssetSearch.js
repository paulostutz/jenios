'use client';
import {useId,useState} from 'react';
import {findAssets} from '../../../lib/platform/asset-catalog.mjs';
import {resolveAssetSymbol} from '../../../lib/platform/asset-symbol.mjs';

export default function AssetSearch({onSelect}){
 const [query,setQuery]=useState(''),[error,setError]=useState('');
 const messageId=useId(),results=findAssets(query);
 function choose(asset){onSelect(asset);setQuery('');setError('');}
 function submit(event){
  event.preventDefault();
  const direct=resolveAssetSymbol(query);
  const exact=results.find(item=>item.ticker.toUpperCase()===query.trim().toUpperCase()||item.symbol.toUpperCase()===query.trim().toUpperCase());
  if(exact){choose(exact);return;}
  if(direct.ok){choose(direct);return;}
  if(results.length===1){choose(results[0]);return;}
  if(results.length>1){setError('Escolha abaixo o ativo e a classe desejados.');return;}
  setError('Ativo não encontrado pelo nome. Tente o código, como PETR3, ou BOLSA:ATIVO, como NASDAQ:AAPL.');
 }
 return <div style={{display:'grid',gap:8}}>
  <form onSubmit={submit} style={{display:'flex',gap:8,alignItems:'center'}}>
   <input type="search" aria-label="Buscar ativo" aria-describedby={messageId} autoComplete="off" maxLength={80}
    placeholder="Nome ou código: Petrobras, PETR3, Bitcoin…" value={query}
    onChange={event=>{setQuery(event.target.value);setError('');}}
    onKeyDown={event=>{if(event.key==='Escape'){setQuery('');setError('');}}}
    style={{flex:1,minWidth:0,padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,fontSize:12,color:'#0f172a',background:'#fff'}}/>
   <button type="submit" style={{background:'#7c3aed',color:'#fff',border:0,padding:'10px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>Buscar Ativo</button>
  </form>
  <p id={messageId} role={error?'status':undefined} style={{margin:0,fontSize:12,color:error?'#9a3412':'#64748b'}}>
   {error||'Busque pelo nome ou código. Para outros ativos, use BOLSA:ATIVO. A disponibilidade do gráfico depende do TradingView.'}
  </p>
  {results.length>0&&<ul aria-label="Ativos encontrados" style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:4}}>
   {results.map(asset=><li key={asset.symbol}><button type="button" onClick={()=>choose(asset)}
    style={{display:'flex',justifyContent:'space-between',gap:12,textAlign:'left',width:'100%',padding:'10px 12px',border:'1px solid #ddd6fe',borderRadius:8,color:'#4c1d95',background:'#faf5ff',cursor:'pointer'}}>
    <span>{asset.name}</span><strong>{asset.ticker}</strong>
   </button></li>)}
  </ul>}
 </div>;
}
