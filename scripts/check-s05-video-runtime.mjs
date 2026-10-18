/** S05 B04: report whether the deployment contains an executable transcoder; no transcoding or media requests. */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {checkVideoRuntime} from '../lib/social/video-runtime-diagnostics.mjs';
const require=createRequire(import.meta.url);
export async function inspectS05VideoBinary({resolveBinary=()=>require('ffmpeg-static')}={}){
 const result=await checkVideoRuntime({enabled:true,resolveBinary});
 return {transcoder:result.optimization,optimizedPlaybackEnabled:false,originalFallback:true};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const report=await inspectS05VideoBinary();
 process.stdout.write('S05 video capability (no binary path): '+JSON.stringify(report)+'\n');
 // Absence does not block the preview; the feature stays disabled and is reported as pending.
}
