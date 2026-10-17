import {socialContext} from '../auth.mjs';
import {accountDeletionRequest} from '../../../../lib/social/account-deletion.mjs';
export const dynamic='force-dynamic';
export const GET=request=>accountDeletionRequest(request,{context:socialContext});
export const POST=request=>accountDeletionRequest(request,{context:socialContext});
