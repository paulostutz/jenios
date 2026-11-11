import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {ownerStateHttp,readJeniosState} from '../../../../../lib/platform/ultra/web/owner-state-http.mjs';
import {createRuntimeSource} from '../../../../../lib/platform/ultra/web/runtime-source.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){
 let db;
 const getUser=async req=>{
  const token=(req.headers.get('authorization')??'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1];if(!token)return null;
  db??=getJeniosPlatformAdmin();const {data,error}=await db.auth.getUser(token);return error?null:data?.user;
 };
 return ownerStateHttp(request,{platform:'jenios',getUser,readState:async user=>{
  let remoteState=null;try{remoteState=await createRuntimeSource({env:process.env})({platform:'jenios',subject:user.id});}catch{}
  return readJeniosState(db,user,{remoteState});
 }});
}
