import {createR65ObservationHandler} from '../../../../lib/platform/research/robot-r65-http.mjs';
import {readR64SourceConfiguration} from '../../../../lib/platform/research/robot-r64-access.mjs';
import {createR65Runtime} from '../../../../lib/platform/research/robot-r65-runtime.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=createR65ObservationHandler({getSource:()=>readR64SourceConfiguration(process.env),
  getStore:()=>createR65Runtime().lifecycleStore});
