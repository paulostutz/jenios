import { boostContext, boostBody, boostFailure, boostHeaders } from '../../../../lib/boost-api';
import { listBoostCampaigns, boostAction } from '../../../../lib/social/boost.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try { return Response.json(await listBoostCampaigns({ ...await boostContext(request), page: Number(new URL(request.url).searchParams.get('page') || 1) }), { headers: boostHeaders }); } catch (error) { return boostFailure(error); }
}
export async function PATCH(request) {
  try { const ctx = await boostContext(request); return Response.json(await boostAction({ ...ctx, body: await boostBody(request) }), { headers: boostHeaders }); } catch (error) { return boostFailure(error); }
}
