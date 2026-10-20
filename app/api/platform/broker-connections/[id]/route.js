import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {demoHttp} from '../../../../../lib/platform/connections/demo-http.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function DELETE(request,{params}){const {id}=await params;return demoHttp(request,'revoke',{id,getAdmin:getJeniosPlatformAdmin});}
