import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../../../../../lib/admin-access.mjs';
import {assistantSameOrigin} from '../../../../../lib/platform/connections/request-origin.mjs';
import {statusJeniosInter,validateJeniosInterSetup,saveJeniosInter,testJeniosInterAuth}
 from '../../../../../lib/pay/inter-vault.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const failure=e=>Response.json({ok:false,code:e.code||'INTER_SETUP_UNAVAILABLE',
 error:e.status?'Não foi possível validar ou salvar a configuração. Confira os campos e o arquivo do banco.':'A configuração está temporariamente indisponível.'},
 {status:e.status||503,headers});
async function authorize(request){
 requirePayToken(request);const db=getJeniosPayAdmin();
 const user=await requireAdminPermission(request,db,'finance.manage');
 return {db,user};
}
export async function GET(request){
 try{const {db}=await authorize(request);return Response.json({ok:true,configuration:await statusJeniosInter(db)},{headers});}
 catch(e){return failure(e);}
}
export async function POST(request){
 try{
  if(!assistantSameOrigin(request))return Response.json({ok:false,code:'ORIGIN_DENIED'},{status:403,headers});
  const {db,user}=await authorize(request);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))
   return Response.json({ok:false,code:'JSON_REQUIRED'},{status:415,headers});
  if(Number(request.headers.get('content-length')||0)>800000)
   return Response.json({ok:false,code:'BODY_TOO_LARGE'},{status:413,headers});
  const buffer=await request.arrayBuffer();if(buffer.byteLength>800000)
   return Response.json({ok:false,code:'BODY_TOO_LARGE'},{status:413,headers});
  let input;try{input=JSON.parse(new TextDecoder().decode(buffer));}catch{
   return Response.json({ok:false,code:'JSON_INVALID'},{status:400,headers});
  }
  if(input?.action==='save'){
   const material=validateJeniosInterSetup(input);
   const configuration=await saveJeniosInter(db,material);
   await auditAdmin(db,user,'inter.configuration_saved',{configVersion:configuration.configurationVersion});
   return Response.json({ok:true,configuration},{headers});
  }
  if(input?.action==='test'&&input?.confirmBankConnection===true&&Object.keys(input).every(k=>['action','confirmBankConnection'].includes(k))){
   // The bank test uses OAuth + GET only and does not initiate real charges.
   const configuration=await testJeniosInterAuth(db);
   await auditAdmin(db,user,'inter.read_only_connection_test',{success:true});
   return Response.json({ok:true,configuration},{headers});
  }
  return Response.json({ok:false,code:'INTER_ACTION_NOT_ALLOWED'},{status:400,headers});
 }catch(e){return failure(e);}
}
