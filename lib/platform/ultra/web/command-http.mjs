import {validateCommand,validateCommandResult,readCommandJson,commandResult} from './command-contract.mjs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'};
export async function ownerCommandHttp(request,{platform,getUser,executeCommand}={}){
 const fail=(status)=>Response.json({error:status===401?'authentication_required':'command_unavailable'},{status,headers});
 let command,dispatched=false;
 try{
  const url=new URL(request.url);
  if(request.method!=='POST')return fail(405);
  if(url.search)return fail(400);
  if(request.headers.get('origin')!==url.origin||!['same-origin','none',null].includes(request.headers.get('sec-fetch-site')))return fail(403);
  const user=await getUser(request);if(!user?.id||user.is_anonymous)return fail(401);
  try{command=validateCommand(await readCommandJson(request));}catch{return fail(400)}
  const current=await getUser(request);if(current?.id!==user.id||current.is_anonymous)return fail(409);
  if(!executeCommand)return Response.json(commandResult(command,'blocked','configuration_required'),{headers});
  dispatched=true;
  const result=validateCommandResult(await executeCommand({platform,subject:user.id,command}),command);
  const after=await getUser(request);if(after?.id!==user.id||after.is_anonymous)return fail(409);
  return Response.json(result,{headers});
 }catch{return dispatched?Response.json(commandResult(command,'unknown','reconcile_without_resend'),{headers}):fail(503)}
}
