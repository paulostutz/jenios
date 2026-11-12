/** Private one-shot CLI: token via bounded stdin, server credentials via private env.
 * No token in argv, no automatic retry, no broker secrets in output.
 */
import {createClient} from '@supabase/supabase-js';
import {runR104PrivatePaperOperator,requireR104OperatorGate} from '../../../lib/platform/connections/private-paper-operator-r104.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
async function input(){
 const chunks=[];let size=0;
 const timer=setTimeout(()=>process.stdin.destroy(Object.assign(new Error('R104_INPUT_TIMEOUT'),{code:'R104_INPUT_TIMEOUT'})),10000);
 try{for await(const chunk of process.stdin){size+=chunk.length;if(size>8192)fail('R104_INPUT_TOO_LARGE');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('R104_INVALID_JSON');}
 }finally{clearTimeout(timer);}
}
let deadline;
try{
 if(process.argv.length!==2)fail('R104_ARGV_FORBIDDEN');
 const request=await input();
 requireR104OperatorGate(process.env,request?.action);
 // Dedicated Platform project already used by this repository. Never fall back
 // to Social, a request-provided URL, or a generic Supabase key.
 if(process.env.PLATFORM_SUPABASE_URL!=='https://xaicvhagftzjkqphnbgx.supabase.co'||
    typeof process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY!=='string'||
    process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY.length<20)fail('R104_PLATFORM_CONFIG_REQUIRED');
 deadline=setTimeout(()=>{process.stderr.write('{"ok":false,"code":"R104_OPERATION_TIMEOUT","retryAllowed":false}\n');process.exit(1);},60000);
 const db=createClient(process.env.PLATFORM_SUPABASE_URL,process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options={})=>fetch(url,{...options,redirect:'error',signal:options.signal?
   AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})}});
 const result=await runR104PrivatePaperOperator(request,{db});
 process.stdout.write(JSON.stringify({ok:true,result})+'\n');
}catch(error){
 // Only fixed R104 codes escape. Other modules/provider errors may contain
 // secrets or external identifiers and are mapped to a generic refusal.
 const allowed=new Set(['R104_ARGV_FORBIDDEN','R104_INPUT_TIMEOUT','R104_INPUT_TOO_LARGE','R104_INVALID_JSON',
  'R104_PRIVATE_OPERATOR_DISABLED','R104_ACTION_NOT_CONFIGURED','R104_INVALID_REQUEST',
  'R104_PLATFORM_CONFIG_REQUIRED','R104_PLATFORM_AUTH_REQUIRED','R104_CONNECTION_UNAVAILABLE',
  'R104_DIAGNOSTIC_UNAVAILABLE','R104_DIAGNOSTIC_REQUIRED','R104_DIAGNOSTIC_SCOPE',
  'R104_CLOCK_INVALID','R104_JOURNAL_UNSAFE','R104_EXISTING_JOURNAL_REQUIRED','R104_ACCOUNT_NOT_VERIFIED']);
 process.stderr.write(JSON.stringify({ok:false,code:allowed.has(error?.code)?error.code:'R104_OPERATION_REFUSED',retryAllowed:false})+'\n');
 process.exitCode=1;
}finally{clearTimeout(deadline);}
