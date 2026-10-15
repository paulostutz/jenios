import {getCachedJeniosTrends} from '../../../lib/jeniosTrends.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await getCachedJeniosTrends(),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
