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

  const s={card:{background:"#fff",border:"1px solid #dbe3ed",borderRadius:18,padding:20,boxShadow:"0 5px 18px #12283b0b",color:"#1e334c",fontFamily:"Inter,Arial,sans-serif"},label:{display:"block",fontWeight:700,fontSize:13,marginBottom:7},input:{width:"100%",boxSizing:"border-box",background:"#fff",border:"1px solid #cbd5e1",borderRadius:10,padding:12,fontSize:14,color:"#172d49"},muted:{color:"#66788e",fontSize:12,lineHeight:1.6}};
  return <section style={s.card} aria-label="Validador de Criptoativos">
    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}><div style={{background:"#e9f0f8",borderRadius:12,padding:12,color:"#173b64",fontSize:22}}>◇</div><div><h2 style={{fontSize:19,margin:0}}>Validador de Criptoativos</h2><p style={{...s.muted,margin:"4px 0 0"}}>Carteiras, tokens, contratos e transações</p></div></div>
    <form onSubmit={handleSubmit} style={{display:"grid",gap:14}}>
      <div><label htmlFor="crypto-network" style={s.label}>Rede blockchain</label><select id="crypto-network" value={network} onChange={handleNetworkChange} style={s.input}>{Object.entries(NETWORKS).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></div>
      <div><label htmlFor="crypto-type" style={s.label}>Tipo de análise</label><select id="crypto-type" value={type} onChange={handleTypeChange} style={s.input}>{TYPES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div><label htmlFor="crypto-identifier" style={s.label}>Identificador público</label><textarea id="crypto-identifier" rows={3} value={value} onChange={e=>{setValue(e.target.value);setError("")}} placeholder={NETWORKS[network].placeholder} style={{...s.input,resize:"vertical"}}/></div>
      <p style={{...s.muted,margin:0}}>Nunca informe sua frase-semente, senha ou chave privada.</p>
      {error&&<p role="alert" style={{color:"#a32130",fontSize:13}}>{error}</p>}
      <button type="submit" style={{padding:"13px 16px",background:"#173b64",color:"#fff",border:0,borderRadius:10,fontWeight:800,cursor:"pointer"}}>Preparar consulta</button>
    </form>
    {report&&<div style={{marginTop:16,padding:14,borderRadius:12,background:"#fff8e8",border:"1px solid #f1d49b"}}>
      <strong style={{fontSize:14}}>Pré-análise do identificador</strong>
      <p style={{...s.muted,overflowWrap:"anywhere"}}><b>Rede:</b> {report.network} · <b>Tipo:</b> {report.type}</p>
      <p style={{...s.muted,overflowWrap:"anywhere"}}><b>Identificador:</b> {report.identifier}</p>
      <p style={{...s.muted}}>Ainda não houve validação on-chain. Nenhuma autenticidade, liquidez ou transação foi confirmada.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button type="button" onClick={openExplorer} style={{padding:10,borderRadius:9,border:"1px solid #9cacc1",background:"#fff",cursor:"pointer"}}>Consultar explorador ↗</button><button type="button" onClick={savePDF} style={{padding:10,borderRadius:9,border:"1px solid #9cacc1",background:"#fff",cursor:"pointer"}}>Imprimir pré-análise</button></div>
    </div>}
    <p style={{...s.muted,marginBottom:0,marginTop:16}}>Integração com provedores blockchain pendente. Este formulário não verifica contratos nem produz laudo técnico autenticado.</p>
  </section>;
}
