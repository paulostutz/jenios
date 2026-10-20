import {getJeniosPlatformAdmin} from '../../../../lib/platform/admin-db.mjs';
import {demoHttp} from '../../../../lib/platform/connections/demo-http.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=45;
export async function GET(request){return demoHttp(request,'list',{getAdmin:getJeniosPlatformAdmin});}
export async function POST(request){return demoHttp(request,'create',{getAdmin:getJeniosPlatformAdmin});}
