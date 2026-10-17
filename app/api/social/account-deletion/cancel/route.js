import {socialContext} from '../../auth.mjs';
import {cancelAccountDeletion} from '../../../../../lib/social/account-deletion-cancel.mjs';
export const dynamic='force-dynamic';
export const POST=request=>cancelAccountDeletion(request,{context:socialContext});
