import test from 'node:test';
import assert from 'node:assert/strict';
import {unavailableJeniosIndex,JENIOS_INDEX_NOTICE} from '../lib/bankscore/jenios-index.mjs';
test('missing data produces no numeric rating and preserves the reporting date',()=>{const x=unavailableJeniosIndex({period:202606});assert.equal(x.value,null);assert.equal(x.status,'DADOS_INSUFICIENTES');assert.equal(x.period,202606);assert.equal(x.notice,JENIOS_INDEX_NOTICE);});
test('complete accounting data alone cannot enable a numeric rating',()=>{const x=unavailableJeniosIndex({dataComplete:true,value:900,methodologyValidated:true});assert.equal(x.value,null);assert.equal(x.status,'METODOLOGIA_NAO_VALIDADA');assert.equal(x.methodologyVersion,null);});
