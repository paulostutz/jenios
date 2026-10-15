import { boostContext, boostBody, boostFailure, boostHeaders } from '../../../../lib/boost-api';
import { serveBoost } from '../../../../lib/social/boost-serving.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try { const ctx = await boostContext(request, true); return Response.json(await serveBoost({ ...ctx, body: await boostBody(request) }), { headers: boostHeaders }); } catch (error) { return boostFailure(error); }
}
