import {createRequire} from 'node:module';
import {checkVideoRuntime} from '../../../../lib/social/video-runtime-diagnostics.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const require=createRequire(import.meta.url);
/** Diagnostic only; original video playback always remains available to visitors. */
export async function GET(){
 const enabled=process.env.NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO==='true';
 const result=await checkVideoRuntime({enabled,resolveBinary:()=>require('ffmpeg-static')});
 return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
