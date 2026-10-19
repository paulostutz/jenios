import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayUser} from '../../../../lib/pay/auth.mjs';
import {readVerifiedDiagnostic,saveVerifiedDiagnostic} from '../../../../lib/platform/diagnostic-server.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failed=e=>Response.json({error:e?.status?e.message:'Não foi possível validar o diagnóstico.'},
  {status:e?.status||503,headers});
export async function GET(request) {
  try {
    const db=getJeniosPayAdmin();
    const user=await requirePayUser(request,db);
    return Response.json(await readVerifiedDiagnostic(db,user),{headers});
  } catch(e) {return failed(e);}
}
export async function POST(request) {
  try {
    const claimed=Number(request.headers.get('content-length')||0);
    if (claimed>2048) return Response.json({error:'Dados do diagnóstico inválidos.'},{status:413,headers});
    const db=getJeniosPayAdmin();
    const user=await requirePayUser(request,db);
    const raw=await request.text();
    if(raw.length>2048) return Response.json({error:'Dados do diagnóstico inválidos.'},{status:413,headers});
    let body;
    try {body=JSON.parse(raw);}catch{body=null;}
    return Response.json(await saveVerifiedDiagnostic(db,user,body),{headers});
  } catch(e) {return failed(e);}
}
