/** Node listener for the dedicated authorization host. Does not log requests. */
import {createServer} from 'node:http';
import {mkdirSync,lstatSync,realpathSync,readFileSync} from 'node:fs';
import {alpacaConnectHttpR107,requireR107HttpConfiguration,R107_ORIGIN} from './alpaca-connect-http-r107.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function prepareR107RenderVolume({env=process.env,mountInfo=()=>readFileSync('/proc/self/mountinfo','utf8')}={}){
 const mount='/var/data/jenios-connect',path=mount+'/oauth';
 if(env.RENDER_SERVICE_TYPE!=='web'||!/^srv-[a-z0-9]+$/.test(env.RENDER_SERVICE_ID||'')||
    env.JENIOS_R106_PRIVATE_VOLUME!==path||env.JENIOS_R107_CONNECT_HTTP_ENABLED!=='true')fail('R107_MOUNT_CONFIGURATION_REQUIRED');
 const st=lstatSync(mount);
 if(!st.isDirectory()||st.isSymbolicLink()||realpathSync(mount)!==mount||
    ![0,process.getuid()].includes(st.uid)||!mountInfo().split('\n').some(line=>{
     const f=line.split(' ');return f[4]===mount&&f[5]?.split(',').includes('rw');
    }))fail('R107_PERSISTENT_MOUNT_REQUIRED');
 try{mkdirSync(path,{mode:0o700});}catch(e){if(e.code!=='EEXIST')fail('R107_PERSISTENT_MOUNT_REQUIRED');}
 // Existing directories are never chmod/chown'd. The shared configuration gate
 // verifies identity, owner and mode before any broker request or listener.
 requireR107HttpConfiguration(env);return path;
}
export function createR107ConnectServer({env=process.env,db,clock=Date.now,fetcher=fetch}={}){
 requireR107HttpConfiguration(env);let active=0;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  if(active>=16){res.writeHead(503,{'Cache-Control':'no-store','Connection':'close'});res.end();return;}
  active++;
  try{
   const isHealth=req.method==='GET'&&req.url==='/healthz';
   if(!isHealth&&req.headers.host!=='connect.jenios.com.br')fail('R107_HOST_DENIED');
   if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.length>4096)fail('R107_REQUEST_DENIED');
   if(Object.keys(req.headers).some(name=>['cookie','origin','authorization','content-type'].includes(name)&&
       req.rawHeaders.filter((x,i)=>i%2===0&&x.toLowerCase()===name).length!==1))fail('R107_REQUEST_DENIED');
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.byteLength;if(size>6000)fail('R107_BODY_LIMIT');chunks.push(chunk);}
   if(['GET','HEAD'].includes(req.method)&&size)fail('R107_REQUEST_DENIED');
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
   const request=new Request(R107_ORIGIN+req.url,{method:req.method,headers,
    ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await alpacaConnectHttpR107(request,{env,db,clock,fetcher});
   const output={};response.headers.forEach((value,key)=>{if(key!=='set-cookie')output[key]=value;});
   const cookies=response.headers.getSetCookie();if(cookies.length)output['set-cookie']=cookies;
   res.writeHead(response.status,output);res.end(Buffer.from(await response.arrayBuffer()));
  }catch{
   // No URL, credentials, request body, environment or exception text is logged.
   if(!res.headersSent)res.writeHead(400,{'Cache-Control':'no-store','Content-Type':'application/json','Connection':'close'});
   res.end('{"ok":false,"code":"R107_REQUEST_DENIED","ordersEnabled":false}');
  }finally{active--;}
 });
 server.headersTimeout=10000;server.requestTimeout=15000;server.timeout=60000;server.keepAliveTimeout=5000;
 server.on('clientError',(_error,socket)=>{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');});
 return server;
}
