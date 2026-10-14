import {getJeniosTrends} from '../../../lib/jeniosTrends';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await getJeniosTrends(),{headers:{'Cache-Control':'no-store'}})}
