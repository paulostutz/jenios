/** Visible actions for a user's own deletion request; server remains the final authority. */
export function deletionAction(status){
  if(status==null)return 'request';
  if(status==='pending')return 'cancel';
  if(status==='cancelled')return 'reopen';
  return 'read-only';
}
