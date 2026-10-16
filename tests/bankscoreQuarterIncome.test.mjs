import test from 'node:test';
import assert from 'node:assert/strict';
import {quarterIncome} from '../lib/bankscore/quarter-income.mjs';
const row=(period,value)=>({period,value,institutionCode:'C123',currency:'BRL',scale:1,basis:'semester_to_date',scope:'prudential',consolidationId:'C123',accountingStandard:'COSIF-2025',sourceUrl:'https://www3.bcb.gov.br/ifdata/',documentId:String(period)});
test('June subtracts March and December subtracts September, never annual subtraction',()=>{assert.equal(quarterIncome(row(202606,50),row(202603,30)).value,20);assert.equal(quarterIncome(row(202512,70),row(202509,40)).value,30);assert.throws(()=>quarterIncome(row(202512,70),row(202506,40)));});
test('first quarter of either semester is already quarter-only and remains unreviewed',()=>{for(const p of [202603,202609]){const x=quarterIncome(row(p,-10));assert.equal(x.value,-10);assert.equal(x.reviewed,false);}});
test('no subtraction across institutions, consolidation or accounting standards',()=>{for(const key of ['institutionCode','scope','consolidationId','accountingStandard']){const old=row(202603,30);old[key]='other';assert.throws(()=>quarterIncome(row(202606,50),old));}assert.throws(()=>quarterIncome(row(202606,50)));});
