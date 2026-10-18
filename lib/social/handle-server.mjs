import {validateHandle,parseAvailability} from './handle-policy.mjs';
const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
/** Injected database keeps this boundary testable without a service key or live database. */
export async function handleAvailabilityRequest(request,{database}={}) {
  if(request.method!=='GET')return reply(405,{error:'Método não permitido.'});
  const value=new URL(request.url).searchParams.get('handle');
  const checked=validateHandle(value);
  if(!checked.ok)return reply(400,{error:checked.error});
  try {
    const db=await database();
    if(!db)return reply(503,{error:'Verificação de @ ainda não habilitada. Tente novamente mais tarde.'});
    const {data,error}=await db.rpc('social_handle_availability_v1',{p_handle:checked.handle});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    return reply(200,parseAvailability(row,checked.handle));
  } catch { return reply(503,{error:'Não foi possível verificar o @ no momento. Tente novamente.'}); }
}
