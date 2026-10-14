import { identifyToken, decodeAbiString } from './crypto/token-registry.mjs';

const EVM = {
  ethereum: { label: "Ethereum", rpc: "https://cloudflare-eth.com", env: "ETHEREUM_RPC_URL", explorer: "https://etherscan.io" },
  bsc: { label: "BNB Smart Chain", rpc: "https://bsc-dataseed.binance.org", env: "BSC_RPC_URL", explorer: "https://bscscan.com" },
  polygon: { label: "Polygon", rpc: "https://polygon-rpc.com", env: "POLYGON_RPC_URL", explorer: "https://polygonscan.com" },
  arbitrum: { label: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc", env: "ARBITRUM_RPC_URL", explorer: "https://arbiscan.io" },
  base: { label: "Base", rpc: "https://mainnet.base.org", env: "BASE_RPC_URL", explorer: "https://basescan.org" },
  avalanche: { label: "Avalanche C-Chain", rpc: "https://api.avax.network/ext/bc/C/rpc", env: "AVALANCHE_RPC_URL", explorer: "https://snowtrace.io" },
};

const labels = { bitcoin: "Bitcoin", solana: "Solana", tron: "TRON", litecoin: "Litecoin" };
const types = new Set(["transaction", "wallet", "token"]);
const CHAIN_IDS={ethereum:1,bsc:56,polygon:137,arbitrum:42161,base:8453,avalanche:43114};

export function normalizeCryptoRequest(body = {}) {
  if(!body || typeof body!=='object' || Array.isArray(body))throw new Error('Consulta inválida.');
  const network = String(body.network || "").toLowerCase();
  const type = String(body.type || "").toLowerCase();
  const identifier = String(body.identifier || "").trim();
  if (!EVM[network] && !labels[network]) throw new Error("Rede não suportada.");
  if (!types.has(type)) throw new Error("Tipo de consulta inválido.");
  if (!identifier || identifier.length > 180) throw new Error("Identificador inválido.");
  if (EVM[network]) {
    const expected = type === "transaction" ? /^0x[a-fA-F0-9]{64}$/ : /^0x[a-fA-F0-9]{40}$/;
    if (!expected.test(identifier)) throw new Error(type === "transaction" ? "Hash EVM inválido." : "Endereço EVM inválido.");
  } else if (network === "bitcoin") {
    if (type === "token") throw new Error("Consulta de token não se aplica ao Bitcoin.");
    if (type === "transaction" && !/^[a-fA-F0-9]{64}$/.test(identifier)) throw new Error("Hash Bitcoin inválido.");
    if (type === "wallet" && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,87}$/.test(identifier)) throw new Error("Endereço Bitcoin inválido.");
  } else if (network === "solana") {
    const pattern = type === 'transaction' ? /^[1-9A-HJ-NP-Za-km-z]{87,88}$/ : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!pattern.test(identifier)) throw new Error("Identificador Solana inválido.");
  } else if (network === "tron") {
    if (type === "transaction" && !/^[a-fA-F0-9]{64}$/.test(identifier)) throw new Error("Hash TRON inválido.");
    if (type !== "transaction" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(identifier)) throw new Error("Endereço TRON inválido.");
  }
  return { network, type, identifier };
}

async function request(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal, cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error("Provedor respondeu HTTP " + response.status + "."),{status:response.status});
    return data;
  } finally { clearTimeout(timer); }
}

async function rpc(fetchImpl, url, method, params) {
  const payload = await request(fetchImpl, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (payload?.error) throw new Error(payload.error.message || "Erro RPC.");
  if(!payload || !Object.hasOwn(payload,'result'))throw new Error('Resposta RPC malformada.');
  return payload?.result;
}

async function validateEvm(input, fetchImpl, env) {
  const config = EVM[input.network];
  const url = env[config.env] || config.rpc;
  const chainId=await rpc(fetchImpl,url,'eth_chainId',[]);
  if(typeof chainId!=='string'||!/^0x[0-9a-f]+$/i.test(chainId)||BigInt(chainId)!==BigInt(CHAIN_IDS[input.network]))throw new Error('O provedor respondeu por uma rede diferente da selecionada.');
  let found = false, status = "não encontrado", evidence = {};
  if (input.type === "transaction") {
    const [tx, receipt] = await Promise.all([rpc(fetchImpl, url, "eth_getTransactionByHash", [input.identifier]), rpc(fetchImpl, url, "eth_getTransactionReceipt", [input.identifier])]);
    if(tx&&String(tx.hash||'').toLowerCase()!==input.identifier.toLowerCase())throw new Error('A transação retornada não corresponde ao hash consultado.');
    if(receipt&&(!tx||String(receipt.transactionHash||'').toLowerCase()!==input.identifier.toLowerCase()||!['0x1','0x0'].includes(receipt.status)))throw new Error('Recibo de transação inválido ou inconsistente.');
    found = Boolean(tx);
    status = receipt ? (receipt.status === "0x1" ? "confirmada" : "falhou on-chain") : (tx ? "pendente" : "não encontrada");
    evidence = tx ? { bloco: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null, de: tx.from, para: tx.to, resultado: receipt?.status ?? null } : {};
  } else {
    const [balance, code, nonce] = await Promise.all([rpc(fetchImpl, url, "eth_getBalance", [input.identifier, "latest"]), rpc(fetchImpl, url, "eth_getCode", [input.identifier, "latest"]), rpc(fetchImpl,url,'eth_getTransactionCount',[input.identifier,'latest'])]);
    if(!/^0x[0-9a-f]+$/i.test(balance||'')||!/^0x[0-9a-f]*$/i.test(code||'')||!/^0x[0-9a-f]+$/i.test(nonce||''))throw new Error('Estado EVM inválido.');
    const isContract = Boolean(code && code !== "0x");
    found = isContract || BigInt(balance)>0n || BigInt(nonce)>0n;
    status = isContract ? 'contrato encontrado' : found ? 'atividade ou saldo observado' : 'endereço válido, sem atividade ou saldo observável';
    evidence = { tipoOnChain: isContract ? "contrato" : "endereço externo", saldoWei: BigInt(balance).toString(), transacoesEnviadas:BigInt(nonce).toString(), bytecode: isContract };
    if (input.type === "token" && !isContract) status = "nenhum contrato neste endereço";
    if(input.type==='token'&&isContract){
      const results=await Promise.allSettled(['0x06fdde03','0x95d89b41','0x313ce567'].map(data=>rpc(fetchImpl,url,'eth_call',[{to:input.identifier,data},'latest'])));
      const [name,symbol,decimals]=results.map(result=>result.status==='fulfilled'?result.value:null);
      evidence.nomeDeclarado=decodeAbiString(name);evidence.simboloDeclarado=decodeAbiString(symbol);
      evidence.casasDecimais=typeof decimals==='string'&&/^0x[0-9a-f]+$/i.test(decimals)&&BigInt(decimals)<=255n?Number(BigInt(decimals)):null;
    }
  }
  const kind = input.type === "transaction" ? "tx" : "address";
  return { found, status, evidence, explorerUrl: config.explorer + "/" + kind + "/" + encodeURIComponent(input.identifier), provider: "JSON-RPC da rede" };
}

async function validateBitcoin(input, fetchImpl) {
  const base = "https://blockstream.info/api";
  if (input.type === "transaction") {
    let tx;
    try{tx=await request(fetchImpl,base+'/tx/'+encodeURIComponent(input.identifier))}catch(error){if(error.status===404)return {found:false,status:'transação não encontrada',evidence:{},explorerUrl:'https://blockstream.info/tx/'+input.identifier,provider:'Blockstream Esplora'};throw error;}
    if(!tx?.txid || tx.txid.toLowerCase()!==input.identifier.toLowerCase())throw new Error('Resposta Bitcoin inconsistente.');
    return { found: Boolean(tx?.txid), status: tx?.status?.confirmed ? "confirmada" : "pendente", evidence: { bloco: tx?.status?.block_height ?? null, confirmada: Boolean(tx?.status?.confirmed) }, explorerUrl: "https://blockstream.info/tx/" + input.identifier, provider: "Blockstream Esplora" };
  }
  const data = await request(fetchImpl, base + "/address/" + encodeURIComponent(input.identifier));
  return { found: Boolean(data?.address), status: data?.address ? "carteira encontrada" : "não encontrada", evidence: { transacoesConfirmadas: data?.chain_stats?.tx_count ?? 0, recebidoSats: data?.chain_stats?.funded_txo_sum ?? 0, gastoSats: data?.chain_stats?.spent_txo_sum ?? 0 }, explorerUrl: "https://blockstream.info/address/" + input.identifier, provider: "Blockstream Esplora" };
}

async function validateSolana(input, fetchImpl, env) {
  const url = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  if (input.type === "transaction") {
    const result = await rpc(fetchImpl, url, "getSignatureStatuses", [[input.identifier], { searchTransactionHistory: true }]);
    const item = result?.value?.[0];
    return { found: Boolean(item), status: item ? (item.err ? "falhou on-chain" : (item.confirmationStatus || "encontrada")) : "não encontrada", evidence: item ? { slot: item.slot, confirmacoes: item.confirmations, erro: item.err } : {}, explorerUrl: "https://explorer.solana.com/tx/" + input.identifier, provider: "Solana JSON-RPC" };
  }
  const result = await rpc(fetchImpl, url, "getAccountInfo", [input.identifier, { encoding: "jsonParsed" }]);
  const item = result?.value;
  const tokenMint=Boolean(item&&!item.executable&&item.data?.parsed?.type==='mint');
  return { found: Boolean(item), status: input.type==='token'?(tokenMint?'mint de token encontrado':'mint de token não confirmado'):item ? (item.executable ? "programa encontrado" : "conta encontrada") : "não encontrada", evidence: item ? { lamports: item.lamports, owner: item.owner, executavel: item.executable, tokenMint } : {}, explorerUrl: "https://explorer.solana.com/address/" + input.identifier, provider: "Solana JSON-RPC" };
}

async function validateTron(input, fetchImpl, env) {
  const base = (env.TRON_API_URL || "https://api.trongrid.io").replace(/\/$/, "");
  const endpoint = input.type === "transaction" ? "wallet/gettransactionbyid" : input.type === "token" ? "wallet/getcontract" : "wallet/getaccount";
  const data = await request(fetchImpl, base + "/" + endpoint, { method: "POST", headers: { "content-type": "application/json", ...(env.TRON_PRO_API_KEY ? { "TRON-PRO-API-KEY": env.TRON_PRO_API_KEY } : {}) }, body: JSON.stringify(input.type === "transaction" ? { value: input.identifier } : { address: input.identifier, visible: true }) });
  if(data?.Error||data?.error||data?.result?.result===false)throw new Error('TRON recusou a consulta.');
  const found = input.type === "transaction" ? data?.txID?.toLowerCase()===input.identifier.toLowerCase() : input.type==='token'?Boolean(data?.contract_address):Boolean(data?.address);
  return { found, status: found ? "encontrado on-chain" : "não encontrado", evidence: found ? { id: data.txID || data.address || input.identifier, resultadoExecucao:data.ret?.[0]?.contractRet||null, confirmacaoEmBloco:'Não consultada neste endpoint' } : {}, explorerUrl: "https://tronscan.org/#/" + (input.type === "transaction" ? "transaction" : "address") + "/" + input.identifier, provider: "TRON Grid" };
}

export async function validateCrypto(body, { fetchImpl = fetch, env = process.env } = {}) {
  const input = normalizeCryptoRequest(body);
  if (input.network === "litecoin") return { ...input, networkLabel: labels.litecoin, supported: false, found: false, status: "provedor ainda não homologado", evidence: {}, explorerUrl: "https://blockchair.com/litecoin/search?q=" + encodeURIComponent(input.identifier), provider: null, checkedAt: new Date().toISOString() };
  let result;
  try {
    result = EVM[input.network] ? await validateEvm(input, fetchImpl, env) : input.network === "bitcoin" ? await validateBitcoin(input, fetchImpl) : input.network === "solana" ? await validateSolana(input, fetchImpl, env) : await validateTron(input, fetchImpl, env);
  } catch (error) {
    result = { found: false, status: "provedor temporariamente indisponível", evidence: {}, providerError: error?.message || "Falha de consulta" };
  }
  const tokenOnChain=input.network==='solana'?result.evidence?.tokenMint:EVM[input.network]?result.evidence?.bytecode:result.found;
  const authenticity=input.type==='token'?identifyToken(input.network,input.identifier,{onChain:result.providerError?null:tokenOnChain,symbol:result.evidence?.simboloDeclarado}):null;
  return { ...input, networkLabel: EVM[input.network]?.label || labels[input.network], supported: true, ...result, authenticity, checkedAt: new Date().toISOString(), disclaimer: "Consulta de estado observável e comparação com catálogo limitado de endereços publicados pelos emissores. Não comprova titularidade, liquidez, ausência de fraude, auditoria de código ou autenticidade de todos os ativos de uma carteira." };
}
