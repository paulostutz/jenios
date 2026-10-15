import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCryptoRequest, validateCrypto } from "../lib/crypto-validator.mjs";

test("rejeita identificadores EVM malformados", () => {
  assert.throws(() => normalizeCryptoRequest({ network: "ethereum", type: "wallet", identifier: "0x123" }), /inválido/);
});

test("consulta EVM usa RPC no servidor e reconhece contrato", async () => {
  const calls = [];
  const fakeFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.method);
    return { ok: true, json: async () => ({ result: body.method === 'eth_chainId' ? '0x2105' : body.method === "eth_getBalance" ? "0x10" : "0x6000" }) };
  };
  const report = await validateCrypto({ network: "base", type: "token", identifier: "0x" + "1".repeat(40) }, { fetchImpl: fakeFetch, env: { BASE_RPC_URL: "https://rpc.example" } });
  assert.equal(report.found, true);
  assert.equal(report.status, "contrato encontrado");
  assert.ok(calls.includes('eth_getBalance'));
  assert.ok(calls.includes('eth_getCode'));
  assert.ok(calls.includes('eth_getTransactionCount'));
  assert.equal(calls.filter(method=>method==='eth_call').length,3);
});

test("falha de provedor não vira validação positiva", async () => {
  const report = await validateCrypto({ network: "bitcoin", type: "transaction", identifier: "a".repeat(64) }, { fetchImpl: async () => { throw new Error("offline"); }, env: {} });
  assert.equal(report.found, false);
  assert.equal(report.status, "provedor temporariamente indisponível");
});

test("interface não apresenta mais relatório preliminar", () => {
  const source = readFileSync(new URL("../app/components/CryptoValidator.js", import.meta.url), "utf8");
  assert.match(source, /\/api\/crypto-validator/);
  assert.match(source, /Verificação gratuita/);
  assert.doesNotMatch(source, /Relatório preliminar/);
});
