/** Read-only FFmpeg readiness check. Does not attempt a transcode, write media or reveal server paths. */
import {access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
export async function checkVideoRuntime({enabled=false,resolveBinary,statFile=stat,accessFile=access}={}){
 if(enabled!==true)return {optimization:'disabled',playbackFallback:true};
 try {
  const binary=typeof resolveBinary==='function'?await resolveBinary():null;
  if(typeof binary!=='string'||!binary.startsWith('/')||binary.length>512)return {optimization:'unavailable',playbackFallback:true};
  const metadata=await statFile(binary);
  if(!metadata.isFile()||metadata.size<100000||metadata.size>200_000_000)return {optimization:'unavailable',playbackFallback:true};
  await accessFile(binary,constants.X_OK);
  return {optimization:'binary-present-unverified',playbackFallback:true};
 }catch{return {optimization:'unavailable',playbackFallback:true};}
}
