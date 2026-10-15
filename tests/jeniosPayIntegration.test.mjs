import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const products = readFileSync(new URL("../app/api/jenios-pay/products/route.js", import.meta.url), "utf8");
const gate = readFileSync(new URL("../app/components/SocialChargeButton.js", import.meta.url), "utf8");
const platform = readFileSync(new URL("../app/checkout/page.js", import.meta.url), "utf8");

test("catálogo usa preço server-side e tabela existente", () => {
  assert.match(products, /jenios_pay_products/);
  assert.match(products, /price_cents/);
  assert.doesNotMatch(products, /request\.json/);
});

test("botão inicia checkout com sessão opcional e idempotência", () => {
  assert.match(gate, /supabase\?\.auth\.getSession/);
  assert.match(gate, /idempotency-key/);
  assert.match(gate, /window\.location\.assign/);
});

test("checkout mensal da Platform permanece separado da Social", () => {
  assert.match(platform, /99,90/);
  assert.match(platform, /149,90/);
  assert.match(platform, /199,90/);
  assert.doesNotMatch(platform, /social-bankscore-report|social-crypto-validator|social-specialist|social-boost/);
});
