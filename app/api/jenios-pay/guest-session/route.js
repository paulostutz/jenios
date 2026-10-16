import {guestEnabled,newGuestCookie} from '../../../../lib/pay/buyer.mjs';
export const dynamic='force-dynamic';
export async function POST(request){try{if(!guestEnabled())return Response.json({error:'A compra sem cadastro está em preparação. Tente novamente após a liberação.'},{status:503});return Response.json({ok:true},{headers:{'Set-Cookie':newGuestCookie(request),'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:e.status||503});}}
