import {getCachedJeniosTrends} from '../../../lib/jeniosTrends.mjs';
import {getMegaPulse} from '../../../lib/megapulse.mjs';
import {getWhaleTransfers} from '../../../lib/whale-transfers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){const [data,mega,whales]=await Promise.all([getCachedJeniosTrends(),getMegaPulse(),getWhaleTransfers()]); data.baleias=whales.rows;data.modulos.baleias=whales.status;data.megapulse=mega.rows; data.modulos.megapulse=mega.status; return Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
