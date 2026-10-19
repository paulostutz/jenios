import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAGNOSTIC_TABLE,DIAGNOSTIC_VERSION,normalizeDiagnosticForm,classifyServerDiagnostic,
  readVerifiedDiagnostic,saveVerifiedDiagnostic,projectVerifiedDiagnostic
} from '../lib/platform/diagnostic-server.mjs';
import {
  currentPlatformSession,readSessionMode,writeSessionMode,loadAccountDiagnostic,
  submitAccountDiagnostic,sessionModeKey
} from '../lib/platform/diagnostic-client.mjs';

const person=id=>({id});
function createMockDB(){
 const rows=new Map();
 const db={
  rows,from(table){
    assert.equal(table,DIAGNOSTIC_TABLE);
    return {
      select(){
        return {eq(field,id){assert.equal(field,'user_id');return {async maybeSingle(){
          return {data:rows.get(id)||null,error:null};
        }};}};
      },
      async insert(row){
        if(rows.has(row.user_id)) return {error:{code:'23505'}};
        rows.set(row.user_id,{...row,created_at:'2026-10-19T01:00:00Z'});
        return {error:null};
      }
    };
  }
 };
 return db;
}
const auth=(id='a',token='TOKEN')=>({auth:{async getSession(){
  return {data:{session:{access_token:token,user:person(id)}},error:null};
}}});
const storage=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))};
};

test('exige exatamente cinco respostas inteiras e timeframe suportado',()=>{
 const f=normalizeDiagnosticForm({answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.equal(f.answers.length,5);
 for(const wrong of [
  {answers:[4,4,4],timeframe:'SWING'},
  {answers:[4,4,4,4,9],timeframe:'SWING'},
  {answers:[4,4,4,4,4.5],timeframe:'SWING'},
  {answers:[4,4,4,4,-1],timeframe:'SWING'},
  {answers:[4,4,4,4,4],timeframe:'SEMANA'},
  null,{},[],{answers:'44444',timeframe:'SWING'}
 ]) assert.throws(()=>normalizeDiagnosticForm(wrong),{status:400});
});
test('classificação manual usa apenas respostas fechadas, não scores do navegador',()=>{
 const s=classifyServerDiagnostic({answers:[4,4,4,4,4],timeframe:'ESTRUTURADO',scores:{impulsivo:10000}});
 assert.equal(s.initial_mode,'manual');
 assert.equal(s.scores.tecnico_positivo,10);
 assert.equal(s.methodology,DIAGNOSTIC_VERSION);
});
test('perfil de risco utiliza reversão como orientação sem liberar ordens',()=>{
 const r=classifyServerDiagnostic({answers:[0,2,0,4,1],timeframe:'SWING'});
 assert.equal(r.initial_mode,'reversa');
 assert.equal('executionAuthorized' in r,false);
});
test('não expõe laudo inválido',()=>{
 assert.equal(projectVerifiedDiagnostic({initial_mode:'manual',methodology:'LEGACY',timeframe:'SWING'}),null);
 assert.equal(projectVerifiedDiagnostic({initial_mode:'auto',methodology:DIAGNOSTIC_VERSION,timeframe:'SWING'}),null);
});
test('GET sem laudo retorna pendente sem simular autorização',async()=>{
 assert.deepEqual(await readVerifiedDiagnostic(createMockDB(),person('a')),{completed:false,verified:false});
});
test('POST grava perfil do usuário autenticado e GET o recupera',async()=>{
 const db=createMockDB();
 const s=await saveVerifiedDiagnostic(db,person('a'),{answers:[4,4,4,4,4],timeframe:'RAPIDO'});
 assert.equal(s.verified,true);assert.equal(s.mode,'manual');assert.equal(db.rows.size,1);
 assert.equal((await readVerifiedDiagnostic(db,person('a'))).mode,'manual');
});
test('duas contas não compartilham diagnóstico',async()=>{
 const db=createMockDB();
 await saveVerifiedDiagnostic(db,person('a'),{answers:[0,0,0,0,0],timeframe:'RAPIDO'});
 await saveVerifiedDiagnostic(db,person('b'),{answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.equal((await readVerifiedDiagnostic(db,person('a'))).mode,'reversa');
 assert.equal((await readVerifiedDiagnostic(db,person('b'))).mode,'manual');
});
test('submissão posterior não altera o modo inicial imutável',async()=>{
 const db=createMockDB();
 await saveVerifiedDiagnostic(db,person('a'),{answers:[0,0,0,0,0],timeframe:'RAPIDO'});
 const second=await saveVerifiedDiagnostic(db,person('a'),{answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.equal(second.mode,'reversa');assert.equal(db.rows.size,1);
});
test('conta anônima e não autenticada são recusadas',async()=>{
 const db=createMockDB();
 await assert.rejects(()=>readVerifiedDiagnostic(db,null),{status:401});
 await assert.rejects(()=>saveVerifiedDiagnostic(db,{id:'a',is_anonymous:true},{answers:[4,4,4,4,4],timeframe:'SWING'}),{status:401});
});
test('erro do banco interrompe com status 503',async()=>{
 const broken={from(){return{select(){return{eq(){return{maybeSingle:async()=>({error:{message:'offline'}})}}}}}}};
 await assert.rejects(()=>readVerifiedDiagnostic(broken,person('a')),{status:503});
});
test('a preferência de modo permanece separada por usuário',()=>{
 const s=storage();writeSessionMode(s,'user-a','reversa');writeSessionMode(s,'user-b','manual');
 assert.equal(readSessionMode(s,'user-a'),'reversa');
 assert.equal(readSessionMode(s,'user-b'),'manual');
 assert.equal(readSessionMode(s,'guest'),null);
 assert.notEqual(sessionModeKey('user-a'),sessionModeKey('user-b'));
});
test('não aceita modo desconhecido ou alteração de chave global',()=>{
 const s=storage();
 assert.equal(writeSessionMode(s,'a','auto'),false);
 assert.equal(readSessionMode(s,'a'),null);
 assert.equal(s.getItem('jenios_modo_operacional'),null);
});
test('sessão anônima ou ausente não vira diagnóstico verificado',async()=>{
 assert.equal(await currentPlatformSession(null),null);
 assert.equal(await currentPlatformSession({auth:{async getSession(){return {data:{session:{access_token:'a',user:{id:'b',is_anonymous:true}}}};}}}),null);
 const r=await loadAccountDiagnostic(null,async()=>{throw Error('must not call');});
 assert.equal(r.verified,false);assert.equal(r.reason,'auth_required');
});
test('GET autenticado só confia em resposta do endpoint',async()=>{
 const result=await loadAccountDiagnostic(auth('a'),async()=>({ok:true,json:async()=>({verified:true,completed:true,mode:'reversa',createdAt:'2026-10-19T00:00:00Z'})}));
 assert.equal(result.verified,true);assert.equal(result.userId,'a');assert.equal(result.mode,'reversa');
});
test('falhas do endpoint não são convertidas em confirmação do navegador',async()=>{
 const r=await loadAccountDiagnostic(auth('a'),async()=>({ok:false,status:503}));
 assert.equal(r.verified,false);assert.equal(r.reason,'backend_unavailable');
 const x=await submitAccountDiagnostic(auth('a'),[4,4,4,4,4],'SWING',async()=>{throw Error('offline')});
 assert.equal(x.verified,false);
});
test('POST leva apenas respostas e timeframe, nunca autorização real',async()=>{
 let args=null;
 const r=await submitAccountDiagnostic(auth('a'),[4,4,4,4,4],'SWING',async(url,opt)=>{
   args={url,opt};return{ok:true,json:async()=>({verified:true,mode:'manual'})};
 });
 assert.equal(r.verified,true);
 assert.equal(args.url,'/api/platform/diagnostico');
 assert.deepEqual(JSON.parse(args.opt.body),{answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.match(args.opt.headers.authorization,/Bearer TOKEN/);
});
