"use client";

import { useState } from "react";
import SocialChargeButton from "./SocialChargeButton";

const NETWORKS = {
  bitcoin: { label: "Bitcoin", placeholder: "Hash da transação ou endereço BTC" },
  ethereum: { label: "Ethereum (ERC-20)", placeholder: "Hash, carteira ou contrato 0x..." },
  bsc: { label: "BNB Smart Chain (BEP-20)", placeholder: "Hash, carteira ou contrato 0x..." },
  tron: { label: "TRON (TRC-20)", placeholder: "Hash, carteira ou contrato TRON" },
  solana: { label: "Solana", placeholder: "Assinatura, carteira ou endereço do token" },
  polygon: { label: "Polygon", placeholder: "Hash, carteira ou contrato 0x..." },
  arbitrum: { label: "Arbitrum", placeholder: "Hash, carteira ou contrato 0x..." },
  base: { label: "Base", placeholder: "Hash, carteira ou contrato 0x..." },
  avalanche: { label: "Avalanche C-Chain", placeholder: "Hash, carteira ou contrato 0x..." },
  litecoin: { label: "Litecoin (aguardando homologação)", placeholder: "Hash da transação ou endereço LTC" },
};

const TYPES = [
  { value: "transaction", label: "Transação / Hash" },
  { value: "wallet", label: "Carteira" },
  { value: "token", label: "Token / Contrato" },
];

export default function CryptoValidator() {
  const [network, setNetwork] = useState("ethereum");
  const [type, setType] = useState("transaction");
  const [value, setValue] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() { setReport(null); setError(""); }

  async function handleSubmit(event) {
    event.preventDefault();
    const identifier = value.trim();
    if (!identifier) return setError("Informe o endereço, contrato ou hash que deseja consultar.");
    reset();
    setLoading(true);
    try {
      const response = await fetch("/api/crypto-validator", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ network, type, identifier }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Não foi possível consultar a rede.");
      setReport(payload.report);
    } catch (requestError) {
      setError(requestError.message || "Não foi possível consultar a rede.");
    } finally { setLoading(false); }
  }

  async function savePDF() {
    if (!report) return;
    setError("");
    try {
      const response = await fetch("/api/crypto-validator/pdf", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ network, type, identifier: report.identifier }),
      });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "jenios-validacao-" + network + ".pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(requestError.message || "Não foi possível gerar o PDF."); }
  }

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl">◈</div>
        <div><h2 className="text-lg font-bold">Validador de Criptoativos</h2><p className="mt-1 text-sm text-slate-500">Consulta on-chain feita pelo servidor, sem solicitar chaves privadas.</p></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-semibold">Rede blockchain
          <select value={network} onChange={(event) => { setNetwork(event.target.value); reset(); }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
            {Object.entries(NETWORKS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">O que deseja consultar?
          <select value={type} onChange={(event) => { setType(event.target.value); reset(); }} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
            {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Identificador
          <textarea value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} placeholder={NETWORKS[network].placeholder} rows={3} spellCheck={false} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm" />
        </label>
        <p className="text-xs text-slate-500">Nunca informe frase-semente, senha ou chave privada.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Consultando a blockchain…" : "Validar on-chain"}</button>
      </form>
      {report && (
        <div className={"mt-5 rounded-xl border p-4 " + (report.found ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
          <p className="font-bold">Resultado da consulta on-chain</p>
          <p className="mt-2 text-sm">{report.status}. {report.provider ? "Fonte: " + report.provider + "." : ""}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="font-semibold text-slate-600">Rede</dt><dd>{report.networkLabel}</dd></div>
            <div><dt className="font-semibold text-slate-600">Tipo</dt><dd>{TYPES.find((item) => item.value === report.type)?.label}</dd></div>
            <div><dt className="font-semibold text-slate-600">Identificador</dt><dd className="break-all">{report.identifier}</dd></div>
            <div><dt className="font-semibold text-slate-600">Verificado em</dt><dd>{new Date(report.checkedAt).toLocaleString("pt-BR")}</dd></div>
            {Object.entries(report.evidence || {}).map(([key, item]) => <div key={key}><dt className="font-semibold text-slate-600">{key}</dt><dd className="break-all">{item == null ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item)}</dd></div>)}
          </dl>
          {report.providerError && <p className="mt-3 text-sm">O provedor não respondeu: {report.providerError}</p>}
          {report.disclaimer && <p className="mt-3 text-xs leading-5 text-slate-600">{report.disclaimer}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={report.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl border border-violet-300 bg-white px-3 py-2.5 text-center text-sm font-semibold text-violet-800">Abrir explorador</a>
            <button type="button" onClick={savePDF} className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">Baixar laudo em PDF</button>
          </div>
          <div className="mt-3"><SocialChargeButton productCode="social-crypto-validator" label="Contratar consulta detalhada" target={{ network: report.network, type: report.type, identifier: report.identifier }} /></div>
        </div>
      )}
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Um resultado on-chain não comprova titularidade nem elimina risco de fraude. Litecoin permanece bloqueado até homologação de um provedor.</p>
    </section>
  );
}
