import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyToken, decodeAbiString, TOKEN_REGISTRY } from '../lib/crypto/token-registry.mjs';
import { validateCrypto, normalizeCryptoRequest } from '../lib/crypto-validator.mjs';
import { createCryptoReportPdf } from '../lib/crypto/report-pdf.mjs';
import { PDFDocument } from 'pdf-lib';

test('referência do emissor exige rede e contrato correspondentes',()=>{
  const address=TOKEN_REGISTRY[0].address;
  assert.equal(identifyToken('ethereum',address,{onChain:true}).status,'issuer_address_match');
  assert.equal(identifyToken('base',address,{onChain:true}).status,'not_in_reference_registry');
});
test('endereço de referência não comprova rede quando provedor falha',()=>{
  assert.equal(identifyToken('tron',TOKEN_REGISTRY[2].address).status,'issuer_address_match_chain_unconfirmed');
});
test('cópia do símbolo USDT gera alerta, não selo de autenticidade',()=>{
  assert.equal(identifyToken('ethereum','0x'+'1'.repeat(40),{symbol:'USDT',onChain:true}).status,'symbol_address_mismatch');
});
test('ativo fora de catálogo fica inconclusivo, nunca é chamado falso',()=>{
  const r=identifyToken('ethereum','0x'+'1'.repeat(40),{symbol:'CUSTOM',onChain:true});
  assert.equal(r.status,'not_in_reference_registry');assert.match(r.label,/inconclusiva/);
});
test('Tron e Solana preservam diferenciação de maiúsculas',()=>{
  assert.equal(identifyToken('tron',TOKEN_REGISTRY[2].address.toLowerCase(),{onChain:true}).status,'not_in_reference_registry');
});
test('decodificação ABI suporta bytes32 e rejeita limites inválidos',()=>{
  assert.equal(decodeAbiString('0x'+Buffer.from('USDT').toString('hex').padEnd(64,'0')),'USDT');
  assert.equal(decodeAbiString('0x'+'f'.repeat(128)),null);
});
test('endereço EVM sem saldo, nonce ou bytecode não é chamado carteira existente',async()=>{
  const fetchImpl=async(_url,options)=>({ok:true,json:async()=>({result:JSON.parse(options.body).method==='eth_chainId'?'0x2105':JSON.parse(options.body).method==='eth_getCode'?'0x':'0x0'})});
  const r=await validateCrypto({network:'base',type:'wallet',identifier:'0x'+'1'.repeat(40)},{fetchImpl,env:{}});
  assert.equal(r.found,false);assert.match(r.status,/sem atividade/);
});
test('404 Bitcoin é resultado negativo, não sucesso nem falha genérica',async()=>{
  const r=await validateCrypto({network:'bitcoin',type:'transaction',identifier:'a'.repeat(64)},{fetchImpl:async()=>({ok:false,status:404,json:async()=>null}),env:{}});
  assert.equal(r.found,false);assert.equal(r.status,'transação não encontrada');
});
test('TRON não aceita mensagem Error como evidência positiva',async()=>{
  const r=await validateCrypto({network:'tron',type:'token',identifier:TOKEN_REGISTRY[2].address},{fetchImpl:async()=>({ok:true,json:async()=>({Error:'invalid'})}),env:{}});
  assert.equal(r.found,false);assert.ok(r.providerError);
});
test('assinatura Solana tem formato distinto do endereço',()=>{
  assert.throws(()=>normalizeCryptoRequest({network:'solana',type:'transaction',identifier:TOKEN_REGISTRY[3].address}));
});
test('RPC de rede diferente não valida endereço de referência',async()=>{
  const report=await validateCrypto({network:'ethereum',type:'token',identifier:TOKEN_REGISTRY[0].address},{fetchImpl:async()=>({ok:true,json:async()=>({result:'0x38'})}),env:{}});
  assert.equal(report.found,false);assert.equal(report.authenticity.status,'issuer_address_match_chain_unconfirmed');assert.ok(report.providerError);
});
test('PDF pagina relatórios longos sem perder evidências',async()=>{
  const bytes=await createCryptoReportPdf({networkLabel:'Ethereum',identifier:'0x'+'1'.repeat(40),type:'token',status:'TESTE - SEM CONSULTA REAL',checkedAt:'2026-10-14',evidence:Object.fromEntries(Array.from({length:40},(_,i)=>['campo '+i,'evidência '.repeat(30)])),disclaimer:'Relatório sintético de teste.'});
  const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>1);
});
