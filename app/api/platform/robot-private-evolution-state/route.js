import { createR71Runtime } from '../../../../lib/platform/research/robot-r71-runtime.mjs';
import { readR71SourceConfiguration } from '../../../../lib/platform/research/robot-r71-access.mjs';
import { createR71SourceStateHandler } from '../../../../lib/platform/research/robot-r71-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = createR71SourceStateHandler({ getSource: () => readR71SourceConfiguration(process.env),
  getRuntime: () => createR71Runtime() });
