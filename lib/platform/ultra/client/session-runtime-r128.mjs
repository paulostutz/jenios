import {UltraExecutionRuntimeR127} from './execution-runtime-r127.mjs';
import {normalizeUltraConfig} from '../policy-r125.mjs';
import {digest} from './journal.mjs';
import {randomUUID} from 'node:crypto';

const fail=code=>{throw Error(code);};
const identifier=v=>typeof v==='string'&&/^[-A-Za-z0-9_.:]{1,100}$/.test(v);
const scopeKey='ultra_r127_session_scope',currentKey='ultra_r127_current_session';
const finalPhases=new Set(['ended','expired']);
const running=new WeakMap();
const fencedWrites=new Set(['claim','heartbeat','pause','resume','prepare','transition','applyReceipt','prepareCommand','markCommand','saveTransport']);

/** R128 composes both preserved R127 checkpoints on their existing journal. Offline only.
 * It neither grants access nor creates a billable event or a broker command. */
export class DurableUltraRuntimeR128 extends UltraExecutionRuntimeR127 {
 #rawLedger;#controller=randomUUID();#budgetDigest;
 constructor({sessionId,ownerScope,connectionScope,...options}){
  if(![sessionId,ownerScope,connectionScope].every(identifier))fail('INVALID_SESSION_SCOPE');
  if(!['b3','crypto'].includes(options.market))fail('SESSION_MARKET_OUT_OF_SCOPE');
  const rawLedger=options.ledger,rawClock=options.now??Date.now;
  const record=rawLedger.recordContext,recordScope=rawLedger.recordScope;
  const fullConfig=normalizeUltraConfig(options.config),inputDigest=digest(options.config);
  if(!record||!recordScope||record.sessionId!==sessionId||record.ownerScope!==ownerScope||
   record.connectionId!==connectionScope||record.strategy.configDigest!==inputDigest||
   recordScope.accountBinding!==rawLedger.binding||recordScope.provider!==options.scope?.provider||
   recordScope.product!==(options.scope?.product==='b3_mini'?'b3':options.scope?.product))fail('SESSION_RECORD_ATTRIBUTION_MISMATCH');
  // Install indirection BEFORE R127 constructs guard closures. Replacing this.ledger
  // afterwards cannot fence ledger/clock references captured by those closures.
  const access={control:null,clock:null,dispatch:null};
  const requireControl=()=>{if(!access.control)fail('SESSION_NOT_INITIALIZED');access.control();};
  const ledger=new Proxy(rawLedger,{get:(target,key)=>{
   const value=Reflect.get(target,key);
   if(typeof value!=='function')return value;
   if(key==='ownsLease')return ()=>{requireControl();return value.call(target);};
   if(fencedWrites.has(key))return (...args)=>target.transaction(()=>{requireControl();return value.apply(target,args);});
   return value.bind(target);
  }});
  const adapter=new Proxy(options.adapter,{get:(target,key)=>{
   const value=Reflect.get(target,key);
   if(typeof value!=='function')return value;
   return async (...args)=>{
    requireControl();access.clock();
    if(key==='submitProtected')access.dispatch();
    const result=await value.apply(target,args);
    requireControl();access.clock();
    return result;
   };
  }});
  super({...options,ledger,adapter,now:()=>{if(!access.clock)fail('SESSION_NOT_INITIALIZED');return access.clock();}});
  this.#rawLedger=rawLedger;
  const config=Object.freeze({...this.config,markets:Object.freeze(this.config.markets.map(m=>Object.freeze({...m}))),excludedSymbols:Object.freeze([...this.config.excludedSymbols])});
  Object.defineProperty(this,'config',{value:config,writable:false});
  Object.defineProperty(this,'budget',{value:config.markets.find(m=>m.id===options.market),writable:false});
  this.sessionId=sessionId;this.sessionKey='ultra_r127_session:'+sessionId;
  this.sessionScope=digest({ownerScope,connectionScope,accountBinding:this.ledger.binding,market:options.market});
  this.sessionConfig=digest({config:fullConfig,inputDigest,scope:this.scope});this.sessionAttached=false;
  this.#budgetDigest=digest(this.config);
  for(const name of ['sessionId','sessionKey','sessionScope','sessionConfig'])Object.defineProperty(this,name,{value:this[name],writable:false});
  const clock=rawClock;
  this.now=()=>{
   const now=clock();if(!Number.isSafeInteger(now)||now<0||now>8_640_000_000_000_000-86_400_000)fail('SESSION_CLOCK_INVALID');
   return this.#rawLedger.transaction(()=>{
    const saved=this.#rawLedger.transport(this.sessionKey);
    if(now<(saved?.lastObservedAtMs??0))fail('SESSION_CLOCK_REGRESSED');
    if(saved?.controllerId===this.#controller){
     this.#assertControl();
     // Persist every clock observation used by the runtime, before it can act.
     this.#rawLedger.saveTransport(this.sessionKey,{...saved,lastObservedAtMs:now});
    }
    return now;
   });
  };
  access.control=()=>this.#assertControl();
  access.clock=this.now;
  access.dispatch=()=>{
   this.#assertControl();const saved=this.#verifySessionScope(true),now=this.now();
   if(saved.phase!=='active'||this.#rawLedger.paused())fail('SESSION_OPENINGS_PAUSED');
   if(now>=saved.expiresAtMs)fail('SESSION_DURATION_ELAPSED');
  };
  Object.defineProperty(this,'ledger',{value:ledger,writable:false});
  this.#verifySessionScope();
 }
 #verifySessionScope(requireCurrent=false){
  const scope=this.#rawLedger.transport(scopeKey),session=this.#rawLedger.transport(this.sessionKey);
  if(scope&&scope.digest!==this.sessionScope)fail('SESSION_OWNER_OR_CONNECTION_MISMATCH');
  if(digest(this.config)!==this.#budgetDigest)fail('SESSION_CONFIGURATION_CHANGED');
  if(session&&session.schema!=='JENIOS_ULTRA_DURABLE_SESSION_R128')fail('SESSION_CHECKPOINT_REQUIRES_FINISH');
  if(session&&(session.scopeDigest!==this.sessionScope||session.configDigest!==this.sessionConfig))fail('SESSION_CONFIGURATION_OR_SCOPE_MISMATCH');
  if(requireCurrent){
   if(this.#rawLedger.transport(currentKey)?.key!==this.sessionKey)fail('SESSION_SUPERSEDED');
   if(session?.controllerId!==this.#controller)fail('SESSION_CONTROLLER_SUPERSEDED');
  }
  return session;
 }
 #assertControl(){this.#rawLedger.ownsLease();this.#verifySessionScope(true);}
 #locked(){return running.has(this.#rawLedger)||this.busy;}
 #enter(){if(this.#locked())fail('SESSION_BUSY');running.set(this.#rawLedger,this);}
 #leave(){if(running.get(this.#rawLedger)===this)running.delete(this.#rawLedger);}
 readiness(){
  const result=super.readiness();
  try{if(!this.sessionAttached)fail('SESSION_RESUME_REQUIRED');this.#assertControl();return result;}
  catch{return {...result,status:'needs_reconciliation',reason:'session_control_unverified'};}
 }
 session(){
  const saved=this.#verifySessionScope();if(!saved)return null;
  const {controllerId,...publicSaved}=saved;
  return {...publicSaved,attached:this.sessionAttached&&controllerId===this.#controller,openOrUncertainOperations:this.ledger.pending().length,
   pendingCommands:this.ledger.commands().length,executionEnvironment:'offline_fixture',
   liveExecutionEnabled:false,externalPaperEnabled:false,nativeValidated:false,billingEnabled:false};
 }
 #saveSession(patch,now){
  return this.#rawLedger.transaction(()=>{
   this.#assertControl();const old=this.#verifySessionScope(true);if(!old)fail('SESSION_NOT_STARTED');
   if(now<old.lastObservedAtMs)fail('SESSION_CLOCK_REGRESSED');
   const next={...old,...patch,lastObservedAtMs:now};this.#rawLedger.saveTransport(this.sessionKey,next);return next;
  });
 }
 #failClosed(reason){
  try{this.#rawLedger.transaction(()=>{
   this.#assertControl();this.#rawLedger.pause();const old=this.#rawLedger.transport(this.sessionKey);
   if(old)this.#rawLedger.saveTransport(this.sessionKey,{...old,phase:finalPhases.has(old.phase)?old.phase:'paused',reason});
  });}catch{/* A stale controller or lost lease cannot write the shared journal. */}
 }
 async #activateSession({recover,created}){
  this.#enter();
  try{
   await super.start({recover});
   const saved=this.#verifySessionScope(true),now=this.now();this.deadline=saved.expiresAtMs;this.sessionAttached=true;
   // A pause during risk acknowledgement or preflight wins over Start.
   if(now>=saved.expiresAtMs){this.ledger.pause();this.#saveSession({phase:'expired',reason:'SESSION_DURATION_ELAPSED'},now);}
   else if(saved.phase!=='preparing'){this.ledger.pause();this.#saveSession({},now);}
   else this.#saveSession({phase:'active',reason:null},now);
   return {created,session:this.session()};
  }catch(error){this.#failClosed(error.message==='SESSION_CLOCK_REGRESSED'?'SESSION_CLOCK_REGRESSED':'SESSION_START_FAILED');throw error;}
  finally{this.#leave();}
 }
 async start({recover=false}={}){
  const existing=this.#verifySessionScope();
  if(existing)return {created:false,resumeRequired:!this.session().attached,session:this.session()};
  if(this.#locked())fail('SESSION_BUSY');
  const now=this.now(),current=this.ledger.transport(currentKey),previous=current?this.ledger.transport(current.key):null;
  if(previous&&!finalPhases.has(previous.phase))fail('ANOTHER_SESSION_REQUIRES_FINISH');
  if(this.ledger.pending().length||this.ledger.commands().length)fail('SESSION_EXPOSURE_RECONCILIATION_REQUIRED');
  this.#rawLedger.transaction(()=>{
   this.#verifySessionScope();
   const latest=this.ledger.transport(currentKey),old=latest?this.ledger.transport(latest.key):null;
   if(old&&!finalPhases.has(old.phase))fail('ANOTHER_SESSION_REQUIRES_FINISH');
   if(this.ledger.pending().length||this.ledger.commands().length)fail('SESSION_EXPOSURE_RECONCILIATION_REQUIRED');
   this.#rawLedger.claim(now,{recover});this.#rawLedger.ownsLease();
   this.#rawLedger.saveTransport(scopeKey,{digest:this.sessionScope});
   this.#rawLedger.saveTransport(this.sessionKey,{schema:'JENIOS_ULTRA_DURABLE_SESSION_R128',sessionId:this.sessionId,scopeDigest:this.sessionScope,
    configDigest:this.sessionConfig,controllerId:this.#controller,startedAtMs:now,expiresAtMs:now+this.config.sessionMinutes*60000,lastObservedAtMs:now,
    phase:'preparing',reason:null,finishedAtMs:null});
   this.#rawLedger.saveTransport(currentKey,{key:this.sessionKey});
  });
  return this.#activateSession({recover,created:true});
 }
 async resume({recover=false}={}){
  if(this.#locked())fail('SESSION_BUSY');
  const saved=this.#verifySessionScope();if(!saved)fail('SESSION_NOT_STARTED');
  if(saved.phase==='ended')fail('SESSION_ALREADY_ENDED');
  if(this.ledger.transport(currentKey)?.key!==this.sessionKey)fail('SESSION_SUPERSEDED');
  const now=this.now();
  this.#rawLedger.transaction(()=>{
   this.#verifySessionScope();
   if(this.ledger.transport(currentKey)?.key!==this.sessionKey)fail('SESSION_SUPERSEDED');
   const latest=this.#rawLedger.transport(this.sessionKey);
   if(latest.phase==='ended')fail('SESSION_ALREADY_ENDED');
   if(now<latest.lastObservedAtMs)fail('SESSION_CLOCK_REGRESSED');
   this.#rawLedger.claim(now,{recover});this.#rawLedger.ownsLease();
   this.#rawLedger.saveTransport(this.sessionKey,{...latest,controllerId:this.#controller,phase:'preparing',reason:null,lastObservedAtMs:now});
  });
  return this.#activateSession({recover,created:false});
 }
 pause(){
  this.#assertControl();const saved=this.#verifySessionScope(true);this.ledger.pause();
  let now;try{now=this.now();}catch(error){this.#failClosed('SESSION_CLOCK_REGRESSED');throw error;}
  this.#saveSession({phase:finalPhases.has(saved.phase)?saved.phase:'paused',reason:'USER_PAUSED'},now);
 }
 async tick(){
  if(this.#locked())return {state:'busy',session:this.session()};
  if(!this.sessionAttached)fail('SESSION_RESUME_REQUIRED');
  this.#enter();
  try{
   this.#assertControl();const saved=this.#verifySessionScope(true),now=this.now();this.deadline=saved.expiresAtMs;
   if(now>=saved.expiresAtMs){this.ledger.pause();this.#saveSession({phase:saved.phase==='ended'?'ended':'expired',reason:'SESSION_DURATION_ELAPSED'},now);}
   else if(saved.phase!=='active')this.ledger.pause();
   const result=await super.tick(),latest=this.#verifySessionScope(true),after=this.now();
   if(after>=latest.expiresAtMs){this.ledger.pause();this.#saveSession({phase:latest.phase==='ended'?'ended':'expired',reason:'SESSION_DURATION_ELAPSED'},after);}
   else this.#saveSession({phase:this.ledger.paused()&&latest.phase==='active'?'paused':latest.phase},after);
   return {...result,session:this.session()};
  }catch(error){this.#failClosed(error.message==='SESSION_CLOCK_REGRESSED'?'SESSION_CLOCK_REGRESSED':'SESSION_TICK_FAILED');throw error;}
  finally{this.#leave();}
 }
 async command(kind,operationId,quantity=null){
  this.#enter();
  try{return await super.command(kind,operationId,quantity);}
  catch(error){this.#failClosed('SESSION_COMMAND_FAILED');throw error;}
  finally{this.#leave();}
 }
 async finish(){
  if(!this.sessionAttached)fail('SESSION_RESUME_REQUIRED');this.#enter();
  try{
   this.pause();await this.reconcile();const now=this.now();
   const pending=this.ledger.pending().length||this.ledger.commands().length;
   this.#saveSession({phase:pending?'draining':'ended',reason:pending?'EXPOSURE_NOT_CONFIRMED_CLOSED':null,finishedAtMs:pending?null:now},now);
   return this.session();
  }catch(error){this.#failClosed('SESSION_FINISH_RECONCILIATION_FAILED');throw error;}
  finally{this.#leave();}
 }
}
