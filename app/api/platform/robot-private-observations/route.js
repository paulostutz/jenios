import { createR67ObservationHandler } from '../../../../lib/platform/research/robot-r67-http.mjs';
import { readR67SourceConfiguration } from '../../../../lib/platform/research/robot-r67-access.mjs';
import { createR67Runtime } from '../../../../lib/platform/research/robot-r67-runtime.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = createR67ObservationHandler({ getSource: () => readR67SourceConfiguration(process.env),
  getStore: () => createR67Runtime().store });
