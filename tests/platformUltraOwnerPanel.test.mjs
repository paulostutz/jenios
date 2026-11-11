import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {emptyOwnerState,available,validateOwnerState} from '../lib/platform/ultra/web/state-contract.mjs';
import {ULTRA_PERIODS} from '../lib/platform/ultra/reporting.mjs';
import {formatFinancialAmount} from '../lib/platform/ultra/client/reporting.mjs';
const require=createRequire(import.meta.url),React=require('react'),{transformSync}=require('next/dist/build/swc');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const values=[],effects=[];let cursor=0;const pending=[];const events=new Map();
 const hooks={...React,useState(initial){const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useRef(initial){const i=cursor++;if(!(i in values))values[i]={current:initial};return values[i]},useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){old?.cleanup?.();effects[i]={deps};pending.push(()=>{effects[i].cleanup=fn()})}}};
 const module={exports:{}};const code=transformSync(readFileSync('app/components/platform/UltraOwnerState.js','utf8'),{jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}).code;
 const context=vm.createContext({module,exports:module.exports,AbortController,Intl,Date,window:{addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)},require(name){if(name==='react')return hooks;if(name==='react/jsx-runtime')return require(name);if(name.endsWith('state-contract.mjs'))return {validateOwnerState};if(name.endsWith('client/reporting.mjs'))return {formatFinancialAmount};if(name.endsWith('ultra/reporting.mjs'))return {ULTRA_PERIODS};if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>String(key)});throw Error(name)}});
 new vm.Script(code).runInContext(context);
 return {render(props){cursor=0;const result=module.exports.default(props);for(const effect of pending.splice(0))effect();return result},focus(){events.get('focus')?.()}};
}
function expand(node){if(Array.isArray(node))return node.map(expand);if(!node||typeof node!=='object')return node;if(typeof node.type==='function')return expand(node.type(node.props));return {...node,props:{...node.props,children:expand(node.props?.children)}};}
function text(node){if(Array.isArray(node))return node.map(text).join(' ');if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return text(node.props?.children)}
const props=(subject,load)=>({platform:'jenios',subject,load});
function snapshot(subject,balance){const s=emptyOwnerState({platform:'jenios',subject});s.sections.wallet=available({currency:'BRL',balanceMinor:balance,reservedMinor:0,availableMinor:balance,debitAuthorized:false});return s;}
test('Owner panel displays source-confirmed money and unavailability for absent sections',async()=>{const h=harness(),p=props('owner',async()=>snapshot('owner',12345));h.render(p);await tick();const body=text(expand(h.render(p)));assert.match(body,/123,45/);assert.match(body,/Fonte autorizada indisponível/);assert.doesNotMatch(body,/45.820|Pro \+ 2 Mestres|sincronizadas/);});
test('Owner panel never displays zero for an unavailable wallet',async()=>{const h=harness(),p=props('owner',async()=>emptyOwnerState({platform:'jenios',subject:'owner'}));h.render(p);await tick();const body=text(expand(h.render(p)));assert.match(body,/Fonte autorizada indisponível/);assert.doesNotMatch(body,/0,00/);});
test('Owner panel discards an old request after an account switch',async()=>{const h=harness(),old=deferred(),newer=deferred();h.render(props('first',()=>old.promise));const p=props('second',()=>newer.promise);h.render(p);newer.resolve(snapshot('second',777));await tick();old.resolve(snapshot('first',99999));await tick();const body=text(expand(h.render(p)));assert.match(body,/7,77/);assert.doesNotMatch(body,/999,99/);});
test('Owner panel focus refresh performs a source read rather than local success feedback',async()=>{const h=harness();let reads=0;const p=props('owner',async()=>snapshot('owner',++reads*100));h.render(p);await tick();h.render(p);h.focus();await tick();const body=text(expand(h.render(p)));assert.equal(reads,2);assert.match(body,/2,00/);});
