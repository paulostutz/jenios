/** Generative support is opt-in and fail-closed. No model or paid request without an explicitly approved budget. */
export const JENIOS_LLM_MODEL='gpt-6-luna';
export const MAX_BUDGET_USD=1000;
export const AI_RESERVATIONS=Object.freeze({assistant:2500,tutor:2500}); // conservative micro-USD per call
export function isBudgetConfigured(env=process.env){
 const limit=Number(env.JENIOS_AI_MONTHLY_BUDGET_USD);
 return env.JENIOS_GENERATIVE_ENABLED==='true'&&typeof env.OPENAI_API_KEY==='string'&&env.OPENAI_API_KEY.length>20
  &&env.JENIOS_GENERATIVE_MODEL===JENIOS_LLM_MODEL&&Number.isFinite(limit)&&limit>=1&&limit<=MAX_BUDGET_USD;
}
export function configuredGenerativeEnv(env=process.env){
 const enabled=isBudgetConfigured(env);
 return {...env,OPENAI_API_KEY:enabled?env.OPENAI_API_KEY:'',
  JENIOS_ASSISTANT_MODEL:enabled?JENIOS_LLM_MODEL:'',
  JENIOS_TUTOR_MODEL:enabled?JENIOS_LLM_MODEL:''};
}
export async function reserveGenerativeBudget(db,env,channel,now=Date.now()){
 if(!isBudgetConfigured(env))return false;
 if(!Object.hasOwn(AI_RESERVATIONS,channel))return false;
 const amount=AI_RESERVATIONS[channel],limit=Math.floor(Number(env.JENIOS_AI_MONTHLY_BUDGET_USD)*1000000);
 if(!Number.isSafeInteger(limit)||limit<amount)return false;
 const period=new Date(now).toISOString().slice(0,7);
 // The DB function increments atomically across all serverless instances.
 // If it is absent, rejects, or exhausted, no provider call is made.
 const {data,error}=await db.rpc('jenios_ai_budget_reserve_b131',{
  p_month:period,p_cost_micro_usd:amount,p_limit_micro_usd:limit
 });
 if(error||data!==true)return false;
 return true;
}
