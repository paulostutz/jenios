import {getCachedJeniosTrends} from '../../../lib/jeniosTrends.mjs';
import {getMegaPulse} from '../../../lib/megapulse.mjs';
import {getWhaleTransfers} from '../../../lib/whale-transfers.mjs';
import {createWhaleHistory} from '../../../lib/whale-history.mjs';
import {getJeniosPayAdmin} from '../../../lib/jenios-pay-admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(){
 let history;try{history=createWhaleHistory(getJeniosPayAdmin());}catch{}
 const [data,mega,whales]=await Promise.all([getCachedJeniosTrends(),getMegaPulse(),getWhaleTransfers({history})]);
 data.baleias=whales.rows;data.modulos.baleias=whales.status;data.megapulse=mega.rows;data.modulos.megapulse=mega.status;
 return Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
