'use client';
import { useEffect, useState } from 'react';
export default function BankscoreCoverage({ codigo, periodo }) {
  const [data, setData] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ codigo: String(codigo), ...(periodo ? { periodo: String(periodo) } : {}) }).toString();
  useEffect(() => {
    const controller = new AbortController(); setData(null); setMessage('');
    fetch('/api/bankscore/cobertura?' + query, { cache: 'no-store', signal: controller.signal }).then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error); return result; }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [query]);
  async function download() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/bankscore/cobertura/pdf?' + query, { cache: 'no-store' });
      if (!response.ok) { const result = await response.json(); throw Error(result.error); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = 'jenios-bankscore-cobertura.pdf'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  const coverage = data?.coverage;
  return <section style={{ background: 'white', color: '#173b64', borderRadius: 18, padding: 24, marginBottom: 18 }}><h2>Cobertura dos dados — diagnóstico gratuito</h2>{message && <p role="status">{message}</p>}{!coverage && !message && <p>Conferindo a base existente…</p>}{coverage && <><p>{coverage.reason}</p><p>Referência da instituição: {data.instituicao.periodo}. Último trimestre civil encerrado: {coverage.latestClosedCalendarQuarter}.</p><p>{coverage.periodNotice}</p>{coverage.olderThanClosedQuarter && <p>O período consultado é anterior ao último trimestre civil encerrado; não representa automaticamente a posição atual.</p>}<ul>{coverage.dimensions.map(item => <li key={item.key}><strong>{item.label}</strong>: {item.explanation}</li>)}</ul><h3>Histórico disponível</h3><ul>{coverage.series.map(item => <li key={item.periodo}>{item.periodo}: {item.percentual == null ? 'sem percentual interpretável' : item.percentual.toLocaleString('pt-BR') + '%'} · {item.revisao}</li>)}</ul><p>Indicadores complementares brutos encontrados: {coverage.supplementalIndicators.length}. Presença de dado bruto não significa unidade ou metodologia validada.</p><button disabled={busy} onClick={download}>{busy ? 'Gerando…' : 'Baixar diagnóstico gratuito em PDF'}</button></>}</section>;
}
