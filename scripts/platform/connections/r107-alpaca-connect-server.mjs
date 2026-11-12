/** Dedicated authorization listener; the R100 worker remains separate. */
import {createClient} from '@supabase/supabase-js';
import {createR107ConnectServer,prepareR107RenderVolume} from '../../../lib/platform/connections/alpaca-connect-node-r107.mjs';
try{
 if(process.argv.length!==2)throw Error();
 if(process.env.PLATFORM_SUPABASE_URL!=='https://xaicvhagftzjkqphnbgx.supabase.co'||
    typeof process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY!=='string'||process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY.length<30)throw Error();
 if(process.env.RENDER_SERVICE_ID)prepareR107RenderVolume();
 const port=Number(process.env.PORT||10000);
 if(!Number.isInteger(port)||port<1024||port>65535||[18012,18013,19099].includes(port))throw Error();
 const db=createClient(process.env.PLATFORM_SUPABASE_URL,process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options={})=>fetch(url,{...options,redirect:'error',signal:options.signal?
   AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})}});
 const server=createR107ConnectServer({db});
 server.on('error',()=>{process.stderr.write('{"event":"R107_LISTENER_FAILED","ordersEnabled":false}\n');process.exitCode=1;});
 server.listen(port,'0.0.0.0',()=>process.stdout.write('{"event":"R107_AUTHORIZATION_READY","accountVerified":false,"ordersEnabled":false}\n'));
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>process.exit(1),25000).unref();};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}catch{process.stderr.write('{"event":"R107_BOOT_REFUSED","ordersEnabled":false}\n');process.exitCode=1;}
