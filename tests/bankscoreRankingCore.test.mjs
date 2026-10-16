import test from 'node:test';
import assert from 'node:assert/strict';
import { lerTodasPaginas, prepararRanking } from '../lib/bankscore/ranking-core.mjs';
const row=(id,pct=12)=>({codigo_instituicao:String(id),nome_instituicao:`Banco ${id}`,periodo:202606,tipo_instituicao:1,indice_basileia_bruto:pct/100,indice_basileia_percentual_provisorio:pct});
test('top 10 ordenado e sem duplicatas',()=>{
 const x=prepararRanking([row(1,12),row(2,25),row(1,12),row(3,17)],202606);
 assert.deepEqual(x.ranking.map(r=>r.codigo),['2','3','1']);assert.equal(x.elegiveis,3);
});
test('não confunde valor nulo com zero',()=>{
 const x=prepararRanking([{...row(1),indice_basileia_bruto:null},{...row(2),indice_basileia_percentual_provisorio:null},row(3,-1),row(4,15)],202606);
 assert.deepEqual(x.ranking.map(r=>r.codigo),['4']);
});
test('paginação com último lote incompleto',async()=>{
 const data=Array.from({length:1398},(_,i)=>row(i));let chamadas=0;
 const result=await lerTodasPaginas(async(a,b)=>{chamadas++;return data.slice(a,b+1)});
 assert.equal(result.length,1398);assert.equal(chamadas,3);
});
test('limite exato exige consulta adicional',async()=>{
 const data=Array.from({length:1000},(_,i)=>row(i));let chamadas=0;
 const result=await lerTodasPaginas(async(a,b)=>{chamadas++;return data.slice(a,b+1)},{lote:500,maximo:1000});
 assert.equal(result.length,1000);assert.equal(chamadas,3);
});
test('rejeita ranking truncado',async()=>{
 const data=Array.from({length:1001},(_,i)=>row(i));
 await assert.rejects(lerTodasPaginas(async(a,b)=>data.slice(a,b+1),{lote:500,maximo:1000}),/RANKING_INCOMPLETO/);
});

test('não classifica índice com valor bruto divergente do percentual',()=>{
 const inconsistente={...row(7,18),indice_basileia_bruto:0.05};
 const resultado=prepararRanking([inconsistente,row(8,16)],202606);
 assert.deepEqual(resultado.ranking.map(r=>r.codigo),['8']);
});
