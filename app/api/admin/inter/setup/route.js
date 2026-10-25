import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../../../../../lib/admin-access.mjs';
import {assistantSameOrigin} from '../../../../../lib/platform/connections/request-origin.mjs';
import {statusJeniosInter,validateJeniosInterSetup,testJeniosInterAuth,connectJeniosInter}
 from '../../../../../lib/pay/inter-vault.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const messages={
 INTER_INPUT_INVALID:'Confira o Client ID, o Client Secret, a chave Pix e a confirmação da conexão.',
 INTER_ZIP_INVALID:'O arquivo ZIP não pôde ser validado. Use o ZIP original do Inter, de até 512 KB.',
 INTER_ZIP_UNSAFE:'O ZIP contém arquivos não aceitos. Selecione o arquivo original fornecido pelo Inter.',
 INTER_ZIP_TOO_LARGE:'O conteúdo do ZIP excede o limite permitido. Use o arquivo original do Inter.',
 INTER_CERTIFICATE_AMBIGUOUS:'O ZIP deve conter um único certificado e a chave privada correspondente.',
 INTER_KEY_AMBIGUOUS:'O ZIP deve conter uma única chave privada correspondente ao certificado.',
 INTER_CERTIFICATE_AND_KEY_REQUIRED:'O ZIP precisa conter o certificado e a chave privada fornecidos pelo Inter.',
 INTER_PEM_INVALID:'Não foi possível validar o certificado e a chave privada presentes no ZIP.',
 INTER_KEY_MISMATCH:'O certificado e a chave privada não correspondem. Selecione o ZIP correto do Inter.',
 INTER_CERTIFICATE_EXPIRED:'O certificado está vencido ou ainda não está válido. Gere um novo ZIP no Inter.',
 INTER_CONFIGURATION_REQUIRED:'Cadastre as credenciais e o ZIP antes de testar a configuração salva.',
 INTER_CONFIGURATION_CHANGED:'A configuração foi alterada durante a consulta. Atualize o estado e tente novamente.',
 INTER_SETUP_RATE_LIMITED:'Aguarde um minuto antes de tentar outra conexão ou teste.',
 INTER_BANK_READONLY_CONNECTION_FAILED:'O Inter não confirmou a conexão. Confira as credenciais, a ativação do certificado e as permissões Pix da integração.',
 INTER_VAULT_SAVE_NOT_CONFIRMED:'O salvamento não foi confirmado. Atualize o estado antes de enviar os dados novamente.',
 INTER_BANK_TEST_NOT_RECORDED:'A consulta foi concluída, mas seu registro não foi confirmado. Atualize o estado e tente novamente.',
 INTER_SECURE_CERTIFICATE_INVALID:'O certificado salvo precisa ser renovado. Cadastre o novo ZIP fornecido pelo Inter.',
 INTER_CONFIGURATION_NOT_AUTHENTICATED:'A configuração precisa ser autenticada novamente no Inter.'
};
function failure(e){
 const status=[400,401,403,409,413,415,429,502,503].includes(e?.status)?e.status:503;
 const code=Object.hasOwn(messages,e?.code)?e.code:'INTER_SETUP_UNAVAILABLE';
 const message=status===401?'Entre novamente com a conta Master para configurar o Inter.':
  status===403?'A configuração do Inter é exclusiva da conta Master.':
  messages[code]||'Não foi possível acessar a configuração protegida. Tente novamente em instantes.';
 return Response.json({ok:false,code,error:message},{status,headers:{...headers,...(status===429?{'Retry-After':'60'}:{})}});
}
async function authorize(request){
 requirePayToken(request);
 const db=getJeniosPayAdmin();
 const user=await requireAdminPermission(request,db,'finance.manage');
 return {db,user};
}
export async function GET(request){
 try{const {db}=await authorize(request);return Response.json({ok:true,configuration:await statusJeniosInter(db,process.env)},{headers});}
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
  const buffer=await request.arrayBuffer();
  if(buffer.byteLength>800000)return Response.json({ok:false,code:'BODY_TOO_LARGE'},{status:413,headers});
  let input;
  try{input=JSON.parse(new TextDecoder().decode(buffer));}
  catch{return Response.json({ok:false,code:'JSON_INVALID'},{status:400,headers});}
  const normalized={...input,
   pixKey:typeof input?.pixKey==='string'&&input.pixKey.trim()?input.pixKey:process.env.INTER_PIX_KEY||'',
   accountNumber:typeof input?.accountNumber==='string'&&input.accountNumber.trim()?input.accountNumber:process.env.INTER_ACCOUNT_NUMBER||''
  };
  if(normalized?.action==='connect'&&normalized?.confirmBankConnection===true){
   const material=validateJeniosInterSetup(normalized);
   const configuration=await connectJeniosInter(db,material);
   await auditAdmin(db,user,'inter.configuration_connected',{configVersion:configuration.configurationVersion,readOnlyTest:true});
   return Response.json({ok:true,configuration},{headers});
  }
  if(input?.action==='test'&&input?.confirmBankConnection===true&&Object.keys(input).every(k=>['action','confirmBankConnection'].includes(k))){
   const configuration=await testJeniosInterAuth(db);
   await auditAdmin(db,user,'inter.read_only_connection_test',{success:true});
   return Response.json({ok:true,configuration},{headers});
  }
  return Response.json({ok:false,code:'INTER_ACTION_NOT_ALLOWED'},{status:400,headers});
 }catch(e){return failure(e);}
}
