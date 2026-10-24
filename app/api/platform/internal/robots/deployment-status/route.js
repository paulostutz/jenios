import { createR73DeploymentProbeHandler } from '../../../../../../lib/platform/research/robot-r73-definitive-status.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = createR73DeploymentProbeHandler();
