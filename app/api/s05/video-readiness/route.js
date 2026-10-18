import {createRequire} from 'node:module';
import {checkVideoRuntime} from '../../../../lib/social/video-runtime-diagnostics.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const require=createRequire(import.meta.url);
/** Read-only test. Return status only; never a binary path, media URL or user data. */
export async function GET(){
 const state=await checkVideoRuntime({enabled:true,resolveBinary:()=>require('ffmpeg-static')});
 return Response.json({runtime:state.optimization,originalPlaybackFallback:state.playbackFallback,optimizationEnabled:false},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});
}
