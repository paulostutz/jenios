import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../../../../lib/admin-access.mjs';
import {interConfiguration,diagnoseInter} from '../../../../lib/pay/inter-diagnostics.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=45;
const headers={'Cache-Control':'no-store'};
async function access(request){requirePayToken(request);const db=getJeniosPayAdmin();return {db,user:await requireAdminPermission(request,db,'finance.manage')};}
const failure=e=>Response.json({error:e.status?e.message:'Não foi possível verificar a conexão Inter.'},{status:e.status||503,headers});
export async function GET(request){try{await access(request);return Response.json(interConfiguration(),{headers});}catch(e){return failure(e);}}
export async function POST(request){try{const {db,user}=await access(request);await auditAdmin(db,user,'inter.connection_test',{});return Response.json(await diagnoseInter(),{headers});}catch(e){return failure(e);}}
