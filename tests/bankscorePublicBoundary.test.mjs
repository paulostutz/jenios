import test from 'node:test';
import assert from 'node:assert/strict';
import {montarLaudo} from '../lib/bankscore/report-core.mjs';
import {publicBankscoreSummary} from '../lib/bankscore/public-summary.mjs';
import {createReportPdf} from '../app/api/bankscore/laudo/pdf/route.js';
import {writeFile} from 'node:fs/promises';
const report=montarLaudo({codigo:'123',nome:'Instituição de teste — não representa um banco real',tipo:'Teste',periodo:202606,percentual:14,revisao:'PROVISORIO'});
test('free projection excludes technical and paid data even when source contains it',()=>{
 const result=publicBankscoreSummary({...report,coverage:{private:'never'},historico:[1],orderId:'secret'});
 assert.deepEqual(Object.keys(result).sort(),['instituicao','fonte','homologacao','escopo','chamada'].sort());
 for(const k of ['fundamentos','historico','coverage','interpretacao','classificacao','orderId'])assert.equal(result[k],undefined);
 assert.equal(result.instituicao.percentual,14);
});
test('free and paid PDF render successfully with official branding',async()=>{
 const free=await createReportPdf(report,{summaryOnly:true});const paid=await createReportPdf(report);
 assert.ok(paid.length>free.length);
 await writeFile('/tmp/jenios-free-r4.pdf',free);await writeFile('/tmp/jenios-paid-r4.pdf',paid);
});
