/** B170 — read-only connector catalog. Never accepts keys or invokes a broker. */
import {brokerCapabilities} from '../../../../lib/platform/connections/capabilities.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 return Response.json(brokerCapabilities(),{status:200,headers:{
  'Cache-Control':'no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer'
 }});
}
