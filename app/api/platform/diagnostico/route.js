import {getJeniosPlatformAdmin} from '../../../../lib/platform/admin-db.mjs';
import {requirePayUser} from '../../../../lib/pay/auth.mjs';
import {readVerifiedDiagnostic,saveVerifiedDiagnostic} from '../../../../lib/platform/diagnostic-server.mjs';
import {readPlatformJson} from '../../../../lib/platform/request-limit.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failed=e=>Response.json({error:e?.status?e.message:'Não foi possível validar o diagnóstico.'},
  {status:e?.status||503,headers});
export async function GET(request) {
  try {
    const db=getJeniosPlatformAdmin();
    const user=await requirePayUser(request,db);
    return Response.json(await readVerifiedDiagnostic(db,user),{headers});
  } catch(e) {return failed(e);}
}
export async function POST(request) {
  try {
    const db=getJeniosPlatformAdmin();
    const user=await requirePayUser(request,db);
    const body=await readPlatformJson(request);
    return Response.json(await saveVerifiedDiagnostic(db,user,body),{headers});
  } catch(e) {return failed(e);}
}
