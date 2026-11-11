import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {ownerCommandHttp} from '../../../../../lib/platform/ultra/web/command-http.mjs';
import {createRuntimeCommandSource} from '../../../../../lib/platform/ultra/web/runtime-command.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){
 let db;
 return ownerCommandHttp(request,{platform:'jenios',getUser:async req=>{
  const token=(req.headers.get('authorization')??'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1];if(!token)return null;
  db??=getJeniosPlatformAdmin();const {data,error}=await db.auth.getUser(token);return error?null:data?.user;
 },executeCommand:createRuntimeCommandSource({env:process.env})});
}
