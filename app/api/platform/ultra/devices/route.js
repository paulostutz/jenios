import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {devicesHttp} from '../../../../../lib/platform/ultra/operations-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){return devicesHttp(request,{getAdmin:getJeniosPlatformAdmin});}
export async function POST(request){return devicesHttp(request,{getAdmin:getJeniosPlatformAdmin});}
