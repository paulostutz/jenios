"use client";

import { useState } from "react";

const NETWORKS = {
  bitcoin: {
    label: "Bitcoin",
    explorer: "https://www.blockchain.com/explorer",
    placeholder: "Hash da transação ou endereço BTC",
  },
  ethereum: {
    label: "Ethereum (ERC-20)",
    explorer: "https://etherscan.io",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  bsc: {
    label: "BNB Smart Chain (BEP-20)",
    explorer: "https://bscscan.com",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  tron: {
    label: "TRON (TRC-20)",
    explorer: "https://tronscan.org",
    placeholder: "Hash, carteira ou contrato TRON",
  },
  solana: {
    label: "Solana",
    explorer: "https://explorer.solana.com",
    placeholder: "Assinatura, carteira ou endereço do token",
  },
  polygon: {
    label: "Polygon",
    explorer: "https://polygonscan.com",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  arbitrum: {
    label: "Arbitrum",
    explorer: "https://arbiscan.io",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  base: {
    label: "Base",
    explorer: "https://basescan.org",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  avalanche: {
    label: "Avalanche C-Chain",
    explorer: "https://snowtrace.io",
    placeholder: "Hash, carteira ou contrato 0x...",
  },
  litecoin: {
    label: "Litecoin",
    explorer: "https://blockchair.com/litecoin",
    placeholder: "Hash da transação ou endereço LTC",
  },
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

  function handleNetworkChange(event) {
    setNetwork(event.target.value);
    setReport(null);
    setError("");
  }

  function handleTypeChange(event) {
    setType(event.target.value);
    setReport(null);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const input = value.trim();

    if (!input) {
      setError("Informe o endereço, contrato ou hash que deseja consultar.");
      return;
    }

    if (input.length < 10) {
      setError("O identificador parece muito curto. Confira os dados digitados.");
      return;
    }

    setError("");

    // Esta etapa gera um relatório preliminar.
    // A validação on-chain real será conectada à API do servidor.
    setReport({
      network: NETWORKS[network].label,
      type: TYPES.find((item) => item.value === type)?.label,
      identifier: input,
      date: new Date().toLocaleString("pt-BR"),
    });
  }

  function openExplorer() {
    if (!report) return;

    const base = NETWORKS[network].explorer.replace(/\/$/, "");
    const identifier = encodeURIComponent(report.identifier);

    const url =
      network === "bitcoin"
        ? `${base}/search?search=${identifier}`
        : network === "litecoin"
        ? `${base}/${identifier}`
        : network === "solana"
        ? `${base}/address/${identifier}`
        : `${base}/search?f=${identifier}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function savePDF() {
    if (!report) return;
    window.print();
  }

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl">
          ◈
        </div>

        <div>
          <h2 className="text-lg font-bold">
            Validador de Criptoativos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulte identificadores de ativos digitais em diferentes redes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="crypto-network"
            className="mb-1.5 block text-sm font-semibold"
          >
            Rede blockchain
          </label>

          <select
            id="crypto-network"
            value={network}
            onChange={handleNetworkChange}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          >
            {Object.entries(NETWORKS).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="crypto-type"
            className="mb-1.5 block text-sm font-semibold"
          >
            O que deseja consultar?
          </label>

          <select
            id="crypto-type"
            value={type}
            onChange={handleTypeChange}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          >
            {TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="crypto-identifier"
            className="mb-1.5 block text-sm font-semibold"
          >
            Identificador
          </label>

          <textarea
            id="crypto-identifier"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            placeholder={NETWORKS[network].placeholder}
            rows={3}
            spellCheck={false}
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />

          <p className="mt-1.5 text-xs text-slate-500">
            Nunca informe sua frase-semente, senha ou chave privada.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white transition hover:bg-violet-800"
        >
          Preparar consulta
        </button>
      </form>

      {report && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">
            Relatório preliminar
          </p>

          <p className="mt-2 text-sm text-amber-900">
            A consulta ainda não foi validada pela blockchain. Os dados abaixo
            registram somente o que foi informado no formulário.
          </p>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-slate-600">Rede</dt>
              <dd className="break-words">{report.network}</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-600">Tipo</dt>
              <dd>{report.type}</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-600">
                Identificador consultado
              </dt>
              <dd className="break-all">{report.identifier}</dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-600">Data</dt>
              <dd>{report.date}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openExplorer}
              className="flex-1 rounded-xl border border-violet-300 bg-white px-3 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50"
            >
              Abrir explorador
            </button>

            <button
              type="button"
              onClick={savePDF}
              className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Imprimir / salvar PDF
            </button>
          </div>
        </div>
      )}

      <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        Esta interface não armazena a consulta em um banco de dados. A
        integração com APIs de blockchain ainda precisa ser implementada para
        confirmar transações, identificar contratos e gerar resultados
        efetivamente verificados.
      </p>
    </section>
  );
}