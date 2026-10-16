import { getNewTokenRadar } from '../../../../lib/newTokenRadar.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(await getNewTokenRadar(), { headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
}
