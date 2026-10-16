import {loadTrends} from '../../../lib/trends-service.mjs';
import {getJeniosPayAdmin} from '../../../lib/jenios-pay-admin';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(){let db;try{db=getJeniosPayAdmin();}catch{}return Response.json(await loadTrends(db),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
