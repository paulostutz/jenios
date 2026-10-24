import { handleR70PreflightRequest } from '../../../../lib/platform/research/robot-r70-preflight-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = request => handleR70PreflightRequest(request);
