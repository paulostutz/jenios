import {initialState,learningError,checkState} from './engine.mjs';
const TABLE='jenios_learning_state';
const fields='user_id,revision,state';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function learnerRepository(db,userId){
 if(!uuid.test(userId||''))throw learningError('Identidade inválida.',401);
 const check=row=>{
  if(!row||row.user_id!==userId||!Number.isSafeInteger(row.revision)||row.revision<0||row.revision>=Number.MAX_SAFE_INTEGER)throw learningError('Registro de aprendizagem inválido.',503,'LEARNING_STORAGE_UNAVAILABLE');
  checkState(row.state);
  if(!Array.isArray(row.state.completedLessons)||!Array.isArray(row.state.assessments)||!row.state.mastery||typeof row.state.mastery!=='object')throw learningError('Progresso inválido. Preserve o histórico.',503,'LEARNING_STORAGE_UNAVAILABLE');
  return row;
 };
 return {
  async read(){
   let result=await db.from(TABLE).select(fields).eq('user_id',userId).maybeSingle();
   if(result.error)throw learningError('Progresso indisponível. O módulo precisa estar configurado no servidor.',503,'LEARNING_STORAGE_UNAVAILABLE');
   if(!result.data){
    const created=await db.from(TABLE).insert({user_id:userId,revision:0,state:initialState()}).select(fields).single();
    if(!created.error)return check(created.data);
    if(created.error.code!=='23505')throw learningError('Não foi possível iniciar seu progresso.',503,'LEARNING_STORAGE_UNAVAILABLE');
    result=await db.from(TABLE).select(fields).eq('user_id',userId).maybeSingle();
   }
   if(result.error||!result.data||result.data.user_id!==userId)throw learningError('Progresso indisponível.',503);
   return check(result.data);
  },
  async write(expected,state){
   if(!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER-1)throw learningError('Versão do progresso inválida.');
   check({user_id:userId,revision:expected,state});
   if(Buffer.byteLength(JSON.stringify(state),'utf8')>240000)throw learningError('Progresso excede o limite seguro de armazenamento.',413);
   const result=await db.from(TABLE).update({state,revision:expected+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('revision',expected).select(fields).maybeSingle();
   if(result.error)throw learningError('Não foi possível salvar. Seu progresso não foi confirmado.',503,'SAVE_FAILED');
   if(!result.data)throw learningError('Seu progresso mudou em outra aba. Atualize antes de continuar.',409,'REVISION_CONFLICT');
   return check(result.data);
  }
 };
}