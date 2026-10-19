import { getJeniosPlatformAdmin } from '../../../../lib/platform/admin-db.mjs';
import { requirePayUser } from '../../../../lib/pay/auth.mjs';
import { loadVerifiedRiskSummary } from '../../../../lib/platform/risk-evidence.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request) {
  try {
    const db=getJeniosPlatformAdmin();
    const user=await requirePayUser(request,db);
    return Response.json(await loadVerifiedRiskSummary(db,user),{headers});
  } catch(error) {
    return Response.json({error:error?.status?error.message:'Não foi possível confirmar o histórico de risco.'},
      {status:error?.status||503,headers});
  }
}
