import { createR64IntakeHandler } from '../../../../lib/platform/research/robot-r64-http.mjs';
import { readR64SourceConfiguration } from '../../../../lib/platform/research/robot-r64-access.mjs';
import { createR64Runtime } from '../../../../lib/platform/research/robot-r64-runtime.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=createR64IntakeHandler({getTrustedSource:()=>readR64SourceConfiguration(process.env),
  getStore:()=>createR64Runtime().store});
