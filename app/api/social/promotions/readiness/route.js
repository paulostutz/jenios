import {boostReadiness} from '../../../../../lib/social/boost-readiness.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){return Response.json(boostReadiness(),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
