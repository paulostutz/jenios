import { boostContext, boostBody, boostFailure, boostHeaders } from '../../../../../lib/boost-api';
import { recordBoostEvent } from '../../../../../lib/social/boost-serving.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try { const ctx = await boostContext(request); return Response.json(await recordBoostEvent({ ...ctx, body: await boostBody(request) }), { headers: boostHeaders }); } catch (error) { return boostFailure(error); }
}
