import {UUID,assistantError,INITIAL_ASSISTANT_STATE} from './contracts.mjs';
const TABLE='jenios_assistant_state',fields='user_id,revision,state';
export function assistantRepository(db,userId){
 if(!UUID.test(userId||''))throw assistantError('Identidade inválida.',401);
 function check(row){if(!row||row.user_id!==userId||(!Number.isSafeInteger(row.revision)||row.revision<0)||!['genio','genia'].includes(row.state?.persona)||typeof row.state?.aiConsent!=='boolean'||row.state.version!==1)throw assistantError('Estado do atendimento inválido.',503);return row;}
 return {
  async read(){
   let r=await db.from(TABLE).select(fields).eq('user_id',userId).maybeSingle();
   if(r.error)throw assistantError('O atendimento precisa ser configurado neste ambiente.',503,'STORAGE_UNAVAILABLE');
   if(!r.data){
    const c=await db.from(TABLE).insert({user_id:userId,revision:0,state:INITIAL_ASSISTANT_STATE()}).select(fields).single();
    if(!c.error)return check(c.data);
    if(c.error.code!=='23505')throw assistantError('Não foi possível iniciar o atendimento.',503,'STORAGE_UNAVAILABLE');
    r=await db.from(TABLE).select(fields).eq('user_id',userId).maybeSingle();
   }
   if(r.error)throw assistantError('O atendimento está indisponível.',503);
   return check(r.data);
  },
  async write(expected,state){
   if(!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER-1)throw assistantError('Revisão inválida.');
   check({user_id:userId,revision:expected,state});
   const r=await db.from(TABLE).update({state,revision:expected+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('revision',expected).select(fields).maybeSingle();
   if(r.error)throw assistantError('Não foi possível confirmar suas preferências.',503,'SAVE_FAILED');
   if(!r.data)throw assistantError('Seu atendimento mudou em outra aba. Atualize antes de continuar.',409,'REVISION_CONFLICT');
   return check(r.data);
  }
 };
}