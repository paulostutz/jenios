import {validateSandboxDescriptor,canonicalProtocolJson,BINANCE_PROTOCOL_PRODUCTS} from './binance-action-journal-r119.mjs';
const instances=new WeakSet();
const fail=code=>{throw Error(code);};
/** Scripted JSON-only native protocol sandbox. No URL, socket, fetch or signing. */
export class BinanceProtocolSandboxR119 {
 #responses;#calls=[];#product;
 constructor({product,responses=[]}){
  if(!BINANCE_PROTOCOL_PRODUCTS.includes(product)||!Array.isArray(responses)||responses.length>1000)fail('R119_SANDBOX_SCRIPT_INVALID');
  canonicalProtocolJson(responses);this.#responses=structuredClone(responses);this.#product=product;instances.add(this);Object.freeze(this);
 }
 get product(){return this.#product;}
 get calls(){return structuredClone(this.#calls);}
 get pendingResponses(){return this.#responses.length;}
 append(...responses){canonicalProtocolJson(responses);if(this.#responses.length+responses.length>1000)fail('R119_SANDBOX_SCRIPT_LIMIT');this.#responses.push(...structuredClone(responses));}
 async request(descriptor){
  validateSandboxDescriptor(descriptor,this.#product,{lookup:descriptor.method==='GET'});
  const next=this.#responses[0];
  if(!next||next.method!==descriptor.method||next.path!==descriptor.path)fail('R119_SANDBOX_UNEXPECTED_REQUEST');
  if(next.expectParams&&Object.entries(next.expectParams).some(([k,v])=>descriptor.params[k]!==v))fail('R119_SANDBOX_PARAM_MISMATCH');
  this.#responses.shift();this.#calls.push(structuredClone(descriptor));
  if(next.delayMs!==undefined){if(!Number.isSafeInteger(next.delayMs)||next.delayMs<0||next.delayMs>1000)fail('R119_SANDBOX_DELAY_INVALID');await new Promise(resolve=>setTimeout(resolve,next.delayMs));}
  if(next.failure){if(!['timeout','disconnect','response_lost'].includes(next.failure))fail('R119_SANDBOX_SCRIPT_INVALID');fail('R119_SANDBOX_RESULT_UNKNOWN');}
  if(!Number.isSafeInteger(next.httpStatus)||next.httpStatus<100||next.httpStatus>599)fail('R119_SANDBOX_HTTP_INVALID');
  return structuredClone({httpStatus:next.httpStatus,body:next.body??null});
 }
}
export function requireBinanceProtocolSandboxR119(value,product){if(!instances.has(value)||value.product!==product)fail('R119_NATIVE_TRANSPORT_NOT_RELEASED');return value;}
