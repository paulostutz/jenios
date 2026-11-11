import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
const require=createRequire(import.meta.url);
const React=require('react');
const {transformSync}=require('next/dist/build/swc');
const pagePaths=['app/comunidades/page.js','app/copy-trading/page.js','app/brocker/page.js','app/torneios/page.js','app/engenharia-reversa/page.js','app/risco/page.js'];
const source=path=>readFileSync(path,'utf8');

// Execute only these self-contained page components. No browser, server, session,
// network or real credentials are involved. React elements expose UI handlers.
function pageHarness(path){
 const states=[],alerts=[],timers=[];let cursor=0;
 const react={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];}};
 const module={exports:{}};
 const transformed=transformSync(source(path),{jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const context=vm.createContext({module,exports:module.exports,require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return require(name);throw new Error('Unexpected dependency '+name);},alert:value=>alerts.push(value),setTimeout:callback=>{timers.push(callback);return timers.length;}});
 new vm.Script(transformed.code,{filename:path}).runInContext(context);
 return {alerts,states,flushTimers(){for(const callback of timers.splice(0))callback();},render(){cursor=0;return module.exports.default();}};
}
function all(node,predicate){
 if(node==null||typeof node==='boolean')return [];
 if(Array.isArray(node))return node.flatMap(child=>all(child,predicate));
 if(typeof node!=='object')return [];
 return [...(predicate(node)?[node]:[]),...all(node.props?.children,predicate)];
}
function text(node){
 if(node==null||typeof node==='boolean')return '';
 if(Array.isArray(node))return node.map(text).join(' ').replace(/\s+/g,' ').trim();
 if(typeof node!=='object')return String(node);
 return text(node.props?.children);
}
const elements=(tree,type)=>all(tree,node=>node.type===type);
const button=(tree,label)=>elements(tree,'button').find(node=>text(node).includes(label));
const submit=tree=>elements(tree,'form')[0].props.onSubmit({preventDefault(){}});

test('public truth pages retain their main layout, routes and truthful notices',()=>{
 for(const path of pagePaths){
  const tree=pageHarness(path).render();assert.equal(tree.type,'main');assert.match(text(tree),/[Dd]emonstração/);
  assert.doesNotMatch(text(tree),/418 operadores|340%|512%|12ms|8ms|AES-256|Conectado com Sucesso/);
 }
 const community=pageHarness(pagePaths[0]).render();assert.equal(elements(community,'a')[0].props.href,'/social');
 const broker=pageHarness(pagePaths[2]).render();assert.deepEqual(elements(broker,'a').map(n=>n.props.href),['/dashboard','/social']);
});
test('community selection and repeated send tests never claim publication or live presence',()=>{
 const page=pageHarness(pagePaths[0]);let tree=page.render();
 assert.match(text(tree),/Presença em tempo real indisponível/);assert.match(text(tree),/perfis e as mensagens abaixo são fictícios/);
 for(const [label,title] of [['Cripto Futuros','Sala de demonstração: Cripto'],['Psicologia','Sala de demonstração: Controle'],['B3 &','Sala de demonstração: B3']]){
  button(tree,label).props.onClick();tree=page.render();assert.match(text(tree),new RegExp(title));
 }
 for(let i=0;i<3;i++)button(tree,'Testar envio').props.onClick();
 assert.equal(page.alerts.length,3);for(const message of page.alerts)assert.match(message,/nenhum comentário foi enviado ou publicado/);
 assert.equal(elements(tree,'input')[0].props['aria-label'],'Comentário de demonstração');
});
test('copy trading retains both sample cards without performance, follower or success claims',()=>{
 const page=pageHarness(pagePaths[1]);const tree=page.render();
 assert.equal(elements(tree,'h3').length,2);assert.equal(text(tree).match(/perfil fictício/g).length,2);
 assert.equal(text(tree).match(/Histórico não verificado/g).length,2);
 assert.doesNotMatch(text(tree),/\d+\s*(%|seguidores)|melhores operadores/);
 button(tree,'Conhecer cadastro').props.onClick();for(const node of elements(tree,'button').filter(n=>text(n).includes('Ver exemplo')))node.props.onClick();
 assert.equal(page.alerts.length,3);assert.match(page.alerts[0],/nenhum cadastro/);
 for(const message of page.alerts.slice(1))assert.match(message,/nenhuma conta foi vinculada e nenhuma ordem será copiada/);
});
test('broker initial examples do not imply active connections or measured latency',()=>{
 const tree=pageHarness(pagePaths[2]).render();
 assert.match(text(tree),/2 exemplos locais/);assert.equal(text(tree).match(/Não verificada/g).length,2);assert.equal(text(tree).match(/Não medida/g).length,2);
 assert.doesNotMatch(text(tree),/\d+\s*ativas|Gateways Conectados|Chaves encriptadas/);
 assert.match(text(tree),/não consulta contas, valida chaves ou envia ordens/);
});
test('broker credentials cannot be entered and live option remains unavailable',()=>{
 const page=pageHarness(pagePaths[2]);const tree=page.render();const inputs=elements(tree,'input');
 assert.equal(inputs.length,2);for(const input of inputs){assert.equal(input.props.disabled,true);assert.equal(input.props.onChange,undefined);assert.equal(input.props.value,undefined);assert.equal(input.props.autoComplete,'off');}
 const options=elements(tree,'option');assert.equal(options.find(n=>n.props.value==='producao').props.disabled,true);
 assert.equal(page.states.length,3);assert.doesNotMatch(source(pagePaths[2]),/setApiKey|setApiSecret/);
});
test('broker repeated local adds and removals remain examples; reload restores only examples',()=>{
 const page=pageHarness(pagePaths[2]);let tree=page.render();
 elements(tree,'select')[0].props.onChange({target:{value:'bybit'}});tree=page.render();
 for(let i=0;i<4;i++)submit(tree);
 tree=page.render();assert.match(text(tree),/6 exemplos locais/);
 assert.equal(text(tree).match(/Bybit Derivatives API \(exemplo\)/g).length,4);
 const rows=page.states[2];assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
 for(const row of rows){assert.equal(row.status,'Não verificada');assert.equal(row.ping,'Não medida');assert.equal(row.tipo,'Demonstração local');}
 for(const node of elements(tree,'button').filter(n=>text(n)==='Remover exemplo'))node.props.onClick();
 assert.match(text(page.render()),/0 exemplos locais/);
 submit(page.render());assert.match(text(page.render()),/1 exemplos locais/);
 assert.match(text(pageHarness(pagePaths[2]).render()),/2 exemplos locais/);
 for(const message of page.alerts)assert.match(message,/Nenhuma chave foi validada e nenhuma conexão foi estabelecida/);
});
test('public demo handlers have no network, storage or account activation dependencies',()=>{
 for(const path of pagePaths)assert.doesNotMatch(source(path),/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|localStorage|sessionStorage|supabase|apiSecret|apiKey/);
});
test('truth candidate inventory rejects altered pages, test and manifest while preserving inherited guards',()=>{
 assert.equal(verifyR106PublicGuidance().exactSource,true);
 for(const path of [...pagePaths,'tests/publicTruthReview.test.mjs','docs/release/PUBLIC-TRUTH-CANDIDATE-20261111.json']){
  assert.throws(()=>verifyR106PublicGuidance({read:name=>name===path?Buffer.from('unreviewed change'):readFileSync(name)}));
 }
});

test('tournament has ten clearly fictional layout examples, no user identity, metrics or award promise',()=>{
 const tree=pageHarness(pagePaths[3]).render();const rendered=text(tree);
 assert.match(rendered,/Ranking de demonstração/);assert.match(rendered,/posições e os perfis são fictícios/);
 assert.equal(elements(tree,'tbody').length,1);assert.equal(elements(elements(tree,'tbody')[0],'tr').length,10);
 assert.equal(rendered.match(/Não apuradas/g).length,10);assert.equal(rendered.match(/Não apurada /g).length,10);
 assert.match(rendered,/Prazo do torneio: Não informado/);
 assert.doesNotMatch(rendered,/Paulo Stutz|Você|@paulostutz|R\$|\d+%|Grátis|gratuita|Ranking Oficial|03d 14h/);
 assert.equal(elements(tree,'a')[0].props.href,'/social');
});
test('reverse-engineering examples neither claim realized profits nor account protection',()=>{
 const tree=pageHarness(pagePaths[4]).render();const rendered=text(tree);
 assert.match(rendered,/registros abaixo são fictícios/);assert.match(rendered,/não executa ou inverte ordens/);
 assert.match(rendered,/Sem execução real/);assert.match(rendered,/Resultado não calculado/);
 assert.doesNotMatch(rendered,/Lucro Registrado|Capital Preservado|R\$|Ativado Instantaneamente|20:45:12|19:30:50/);
 assert.equal(elements(tree,'a')[0].props.href,'/dashboard');
});
test('reverse-engineering repeated scenarios stay local and nonfinancial with honest busy state',()=>{
 const page=pageHarness(pagePaths[4]);let tree=page.render();
 for(let i=0;i<3;i++){
  button(tree,'Adicionar cenário').props.onClick();tree=page.render();
  assert.equal(button(tree,'Preparando exemplo local').props.disabled,true);
  button(tree,'Preparando exemplo local').props.onClick();
  page.flushTimers();tree=page.render();assert.equal(button(tree,'Adicionar cenário').props.disabled,false);
 }
 assert.equal(page.states[1].length,5);assert.equal(new Set(page.states[1].map(row=>row.id)).size,5);
 for(const row of page.states[1].slice(0,3)){assert.equal(row.status,'Resultado não calculado');assert.match(row.acao,/sem análise de mercado ou envio de ordens/);}
 assert.doesNotMatch(text(tree),/R\$|Lucro Registrado|Capital Preservado/);
 const reloaded=pageHarness(pagePaths[4]);reloaded.render();assert.equal(reloaded.states[1].length,2);
});
test('risk form starts with unknown limits and no enabled protection',()=>{
 const tree=pageHarness(pagePaths[5]).render();const inputs=elements(tree,'input');
 assert.match(text(tree),/Demonstração de formulário/);assert.match(text(tree),/não aplica limites, bloqueios ou regras/);
 assert.equal(inputs.find(n=>n.props.type==='text').props.value,'');assert.equal(inputs.find(n=>n.props.type==='checkbox').props.checked,false);
 assert.equal(elements(tree,'select')[0].props.value,'');assert.equal(elements(tree,'a')[0].props.href,'/dashboard');
 assert.doesNotMatch(text(tree),/Conservador|Padrão HFT|bloqueia novas entradas automaticamente|sucesso na infraestrutura/);
});
test('risk form edits and repeated submissions only confirm a local draft; later edit clears confirmation',()=>{
 const page=pageHarness(pagePaths[5]);let tree=page.render();
 elements(tree,'input').find(n=>n.props.type==='text').props.onChange({target:{value:'75.00'}});
 elements(tree,'input').find(n=>n.props.type==='checkbox').props.onChange({target:{checked:true}});
 elements(tree,'select')[0].props.onChange({target:{value:'20x'}});
 tree=page.render();submit(tree);submit(tree);tree=page.render();
 assert.equal(elements(tree,'input').find(n=>n.props.type==='text').props.value,'75.00');
 assert.match(text(tree),/Rascunho atualizado somente nesta tela/);assert.match(text(tree),/Nenhuma regra foi salva na conta ou aplicada a ordens/);
 elements(tree,'select')[0].props.onChange({target:{value:'5x'}});assert.doesNotMatch(text(page.render()),/Rascunho atualizado somente/);
 const reloaded=pageHarness(pagePaths[5]).render();assert.equal(elements(reloaded,'input').find(n=>n.props.type==='text').props.value,'');
 assert.equal(elements(reloaded,'input').find(n=>n.props.type==='checkbox').props.checked,false);
});
