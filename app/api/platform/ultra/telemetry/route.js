import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {telemetryHttp} from '../../../../../lib/platform/ultra/operations-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){return telemetryHttp(request,{getAdmin:getJeniosPlatformAdmin});}
