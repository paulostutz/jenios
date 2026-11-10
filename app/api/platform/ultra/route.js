import {getJeniosPlatformAdmin} from '../../../../lib/platform/admin-db.mjs';
import {ultraHttp} from '../../../../lib/platform/ultra/http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){return ultraHttp(request,{getAdmin:getJeniosPlatformAdmin});}
export async function POST(request){return ultraHttp(request,{getAdmin:getJeniosPlatformAdmin});}
