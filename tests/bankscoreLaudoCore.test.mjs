import test from 'node:test';
import assert from 'node:assert/strict';
import {avaliarIndicador, periodoValido} from '../lib/bankscore/laudo-core.mjs';
test('índice consistente',()=>assert.equal(avaliarIndicador({indice_basileia_bruto:0.14,indice_basileia_percentual_provisorio:14}).valido,true));
test('índice divergente',()=>assert.equal(avaliarIndicador({indice_basileia_bruto:0.05,indice_basileia_percentual_provisorio:14}).revisao,'INDICADOR_INCONSISTENTE'));
test('ausente não vira zero',()=>assert.equal(avaliarIndicador({indice_basileia_bruto:null,indice_basileia_percentual_provisorio:null}).valido,false));
test('extremo exige revisão',()=>assert.equal(avaliarIndicador({indice_basileia_bruto:1.4,indice_basileia_percentual_provisorio:140}).valido,false));
test('período de seis dígitos e mês válido',()=>{assert.equal(periodoValido('202606'),true);assert.equal(periodoValido('202613'),false);assert.equal(periodoValido('2026AA'),false)});
