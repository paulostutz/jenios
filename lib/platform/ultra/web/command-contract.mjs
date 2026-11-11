export const actions = ['start','pause','billing','status','policy'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateCommand(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['schema','commandId','action','consentVersion','expectedScope'].includes(k))||value.schema!=='ULTRA_COMMAND_V1'||!uuid.test(value.commandId)||!actions.includes(value.action))throw Error('invalid_command');
 if(value.consentVersion!==undefined&&(typeof value.consentVersion!=='string'||value.consentVersion.length>160))throw Error('invalid_consent');
 if(value.expectedScope!==undefined&&(typeof value.expectedScope!=='string'||!value.expectedScope||value.expectedScope.length>160))throw Error('invalid_scope');
 if(['start','billing'].includes(value.action)&&(!value.consentVersion||!value.expectedScope))throw Error('consent_and_scope_required');
 return structuredClone(value);
}
export function commandResult(command,status,phase){return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:command.commandId,action:command.action,status,phase,actualExecutionAuthorized:false,realDebitAuthorized:false};}
export function validatePolicy(p){
 if(!p||typeof p.consentVersion!=='string'||!p.consentVersion||p.consentVersion.length>160||typeof p.revision!=='string'||!p.revision||p.revision.length>160||!['canStart','canPause','canBill'].every(k=>typeof p[k]==='boolean')||typeof p.reason!=='string'||p.reason.length>300)throw Error('policy_unavailable');
 if(!p.scopes||!['start','pause','billing'].every(k=>typeof p.scopes[k]==='string'&&p.scopes[k].length>0&&p.scopes[k].length<=160))throw Error('command_scopes_required');
 return {...Object.fromEntries(['consentVersion','revision','canStart','canPause','canBill','reason'].map(k=>[k,p[k]])),scopes:Object.fromEntries(['start','pause','billing'].map(k=>[k,p.scopes[k]]))};
}
export function validateCommandResult(value,command){
 if(!value||Object.keys(value).some(k=>!['schema','commandId','action','status','phase','actualExecutionAuthorized','realDebitAuthorized','policy'].includes(k))||value.schema!=='ULTRA_COMMAND_RESULT_V1'||value.commandId!==command.commandId||value.action!==command.action||!['accepted','pending','unknown','blocked'].includes(value.status)||typeof value.phase!=='string'||value.phase.length>100||value.actualExecutionAuthorized!==false||value.realDebitAuthorized!==false)throw Error('invalid_result');
 return {...value,...(value.policy?{policy:validatePolicy(value.policy)}:{})};
}
export async function readCommandJson(request,limit=8192){
 if(!request.headers.get('content-type')?.startsWith('application/json')||!request.body)throw Error('invalid_body');
 const reader=request.body.getReader();let total=0;const parts=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw Error('body_limit')}parts.push(value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}finally{reader.releaseLock()}
}
