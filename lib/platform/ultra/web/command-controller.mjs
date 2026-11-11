import {validatePolicy,validateCommandResult} from './command-contract.mjs';
// Only request identity/reconciliation state is persisted. Never financial balances or proof.
export function createCommandController({platform,subject,storage,send,uuid=()=>crypto.randomUUID()}){
 let generation=0,active=true,busy=false;
 const key=action=>`ultra-command:${platform}:${subject}:${action}`;
 const saved=action=>{const raw=storage.getItem(key(action));return raw?JSON.parse(raw):null;};
 const pending=(policy,action)=>{const record=saved(action);return record&&!(record.terminal===true&&(record.scope!==policy?.scopes?.[action]||record.rejected===true&&(record.revision!==policy?.revision||record.consentVersion!==policy?.consentVersion)))?record:null;};
 return {
  hasPending(policy,action){try{return !!pending(policy,action)}catch{return true}},
  invalidate(){generation++;active=false;},
  async policy(){const ticket=generation;const command={schema:'ULTRA_COMMAND_V1',commandId:uuid(),action:'policy'};const result=validateCommandResult(await send(command),command);if(!active||ticket!==generation)throw Error('SESSION_CHANGED');return result.policy?validatePolicy(result.policy):null;},
  async run(action,policy,consent){
   if(!active||busy)throw Error('COMMAND_BUSY');
   if(!policy?.scopes?.[action]||!policy?.consentVersion||!['start','pause','billing'].includes(action))throw Error('COMMAND_UNAVAILABLE');
   let record=pending(policy,action);const resume=!!record;
   if(!resume&&!policy[{start:'canStart',pause:'canPause',billing:'canBill'}[action]])throw Error('COMMAND_UNAVAILABLE');
   if(!resume&&action!=='pause'&&!consent)throw Error('CONSENT_REQUIRED');
   busy=true;const ticket=generation;
   try{
    if(!record){record={commandId:uuid(),scope:policy.scopes[action],revision:policy.revision,consentVersion:policy.consentVersion,terminal:false};const raw=JSON.stringify(record);storage.setItem(key(action),raw);if(storage.getItem(key(action))!==raw)throw Error('STORAGE_REQUIRED');}
    const command={schema:'ULTRA_COMMAND_V1',commandId:record.commandId,action:resume?'status':action};
    if(!resume&&action!=='pause'){command.consentVersion=policy.consentVersion;command.expectedScope=policy.scopes[action];}
    const result=await send(command);
    if(!active||ticket!==generation)throw Error('SESSION_CHANGED');
    if(result?.commandId!==record.commandId||result?.schema!=='ULTRA_COMMAND_RESULT_V1')throw Error('INVALID_RESULT');
    const validated=validateCommandResult(result,command);
    const terminalPhase={start:'commercial_preparation',pause:'pause_confirmed',billing:'monthly_assessed'}[action];
    const rejected=validated.status==='blocked'&&['stale_scope','authority_or_consent_required','identity_changed'].includes(validated.phase);
    if(resume&&(validated.status==='accepted'&&validated.phase===terminalPhase||rejected)){record.terminal=true;record.rejected=rejected&&validated.phase!=='stale_scope';storage.setItem(key(action),JSON.stringify(record));}
    return validated;
   }finally{busy=false;}
  }
 };
}
