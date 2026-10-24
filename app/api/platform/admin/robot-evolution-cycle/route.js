import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {createR65Runtime} from '../../../../../lib/platform/research/robot-r65-runtime.mjs';
import {createR65AdminHandler} from '../../../../../lib/platform/research/robot-r65-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handle=createR65AdminHandler({getDb:()=>getJeniosPlatformAdmin(),getRuntime:()=>createR65Runtime()});
export const GET=handle;
export const POST=handle;
