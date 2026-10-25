import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {PRO_ADDON_PACKS,PRO_ADDON_TERMS,proAddonAmounts,validProAddonCatalog} from '../lib/assistant/pro-addon-catalog.mjs';
import {proWalletConfig} from '../lib/assistant/pro-wallet-contract.mjs';
for(const pack of PRO_ADDON_PACKS)test('G46 '+pack.code+' rounds down provider capacity and keeps fixed BRL price at FX extremes',()=>{
 for(const fx of [1000000,5123456,100000000]){
  const actual=proAddonAmounts(pack.code,fx);assert.equal(actual.priceCents,pack.providerCapacityBrlCents*3);
  assert.equal(BigInt(actual.providerCapacityNanoUsd),BigInt(pack.providerCapacityBrlCents)*10000000000000n/BigInt(fx));
  assert.equal(actual.retailNanoUsd,actual.providerCapacityNanoUsd*2);
 }
});
test('G46 catalog cannot become a single arbitrary priced offer',()=>{
 const offer={termsVersion:PRO_ADDON_TERMS,baseCurrency:'BRL',baseAmountMinor:null,packs:PRO_ADDON_PACKS};
 assert.equal(validProAddonCatalog(offer),true);assert.equal(validProAddonCatalog({...offer,baseAmountMinor:500}),false);
 assert.equal(validProAddonCatalog({...offer,packs:PRO_ADDON_PACKS.slice(1)}),false);
 const base={id:true,monthly_provider_limit_nano_usd:0,max_request_provider_nano_usd:0,crypto_allowance_nano_usd:0,global_allowance_nano_usd:0,commercial_terms_version:PRO_ADDON_TERMS,topup_currency:'BRL',topup_amount_minor:500};
 assert.equal(proWalletConfig(base).topup.confirmed,false);
 for(const fx of [NaN,0,999999,100000001,5123456.5,'5123456'])assert.throws(()=>proAddonAmounts('ia-500',fx));
});
for(const url of ['postgresql://postgres@remote.example.invalid/jenios_genios_g46_addon_test','postgresql://postgres@127.0.0.1/postgres','postgresql://postgres@127.0.0.1/jenios_genios_g46_addon_test?host=remote.example.invalid'])test('G46 PostgreSQL fixture refuses unsafe target '+url,()=>{
 const r=spawnSync(process.execPath,['scripts/test-genios-addon-g46-postgres.mjs'],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,JENIOS_G46_ADDON_TEST_DATABASE_URL:url}});
 assert.notEqual(r.status,0);assert.match(r.stderr,/G46_ADDON_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK/);
});
