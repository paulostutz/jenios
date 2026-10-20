import {getJeniosPlatformAdmin} from '../../../../../../lib/platform/admin-db.mjs';
import {demoHttp} from '../../../../../../lib/platform/connections/demo-http.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=45;
export async function POST(request,{params}){const {id}=await params;return demoHttp(request,'sync',{id,getAdmin:getJeniosPlatformAdmin});}
