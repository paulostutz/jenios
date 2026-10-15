import { getJeniosPayAdmin } from '../../../lib/jenios-pay-admin';
import { requirePayToken, requirePayUser } from '../../../lib/pay/auth.mjs';
import { SPECIALIST_FIELDS, publicSpecialist, specialistDetails, validateSpecialist } from '../../../lib/social/specialists.mjs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request){
  try{
    const params=new URL(request.url).searchParams;
    const own=params.get('own')==='1',id=params.get('id');if(own)requirePayToken(request);
    if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Object.assign(new Error('Perfil inválido.'),{status:400});
    const db=getJeniosPayAdmin();
    if(own){
      const user=await requirePayUser(request,db);
      const {data,error}=await db.from('jenios_specialist_profiles').select(SPECIALIST_FIELDS).eq('user_id',user.id).maybeSingle();
      if(error)throw error;
      return Response.json({profile:data?{...data,...specialistDetails(data.sobre)}:null},{headers});
    }
    if(id){
      const {data,error}=await db.from('jenios_specialist_profiles').select(SPECIALIST_FIELDS).eq('user_id',id).maybeSingle();
      if(error)throw error;const profile=data?publicSpecialist(data):null;
      if(!profile)throw Object.assign(new Error('Perfil público não encontrado.'),{status:404});
      return Response.json({profile},{headers});
    }
    const page=Number(params.get('page')||1);
    if(!Number.isInteger(page)||page<1||page>10000)throw Object.assign(new Error('Página inválida.'),{status:400});
    const {data,error}=await db.from('jenios_specialist_profiles').select(SPECIALIST_FIELDS).order('user_id').range((page-1)*50,page*50-1);
    if(error)throw error;
    return Response.json({specialists:(data||[]).map(publicSpecialist).filter(Boolean),nextPage:data?.length===50?page+1:null},{headers});
  }catch(error){return Response.json({error:error.status?error.message:'Não foi possível carregar os especialistas.'},{status:error.status||503,headers});}
}
export async function PUT(request){
  try{
    requirePayToken(request);const db=getJeniosPayAdmin();const user=await requirePayUser(request,db);
    const body=await request.json();let payload;try{payload=validateSpecialist(body)}catch(error){error.status=400;throw error}
    const {data,error}=await db.from('jenios_specialist_profiles').upsert({user_id:user.id,...payload,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select(SPECIALIST_FIELDS).single();
    if(error)throw error;
    return Response.json({profile:{...data,...specialistDetails(data.sobre)}},{headers});
  }catch(error){return Response.json({error:error.status?error.message:'Não foi possível salvar seu perfil.'},{status:error.status||503,headers});}
}
