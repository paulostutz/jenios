/** B277 — immutable research triage based on previously recorded evidence, not a media-fetcher.
 * Newly supplied YouTube videos were NOT independently decoded or transcribed in B277.
 * No source citation is proof of trading performance or approval of an operational setup.
 */
import {USER_VIDEO_RESOURCES} from './trade-video-resources.mjs';
import {SUPPLEMENTAL_TRADE_VIDEO_IDS} from './trade-video-supplement-20261021.mjs';

const newIds=new Set(SUPPLEMENTAL_TRADE_VIDEO_IDS);
const frozen=x=>Object.freeze(x);
export const VIDEO_RESEARCH_STATES=frozen({
 caption:'PRIOR_CAPTION_NOTES_ONLY',
 metadata:'PRIOR_METADATA_ONLY',
 pending:'NEW_VIDEO_TRANSCRIPT_UNAVAILABLE',
 playlist:'PLAYLIST_NOT_ENUMERATED'
});
export const B277_EVIDENCE_INVENTORY=frozen(USER_VIDEO_RESOURCES.map(resource=>{
 const isNew=newIds.has(resource.id);
 const kind=isNew?VIDEO_RESEARCH_STATES.pending:
  resource.verification==='transcript_reviewed'?VIDEO_RESEARCH_STATES.caption:
  resource.verification==='needs_playlist_review'?VIDEO_RESEARCH_STATES.playlist:
  VIDEO_RESEARCH_STATES.metadata;
 return frozen({
  videoId:resource.id,url:resource.url,kind:resource.kind,
  catalogVerification:resource.verification,status:kind,
  sourceTitle:isNew?null:resource.title,
  sourceChannel:isNew?null:resource.channel,
  transcriptFetchedInB277:false,visualContentInspectedInB277:false,
  metadataIndependentlyConfirmedInB277:false,
  existingCaptionNotesAvailable:kind===VIDEO_RESEARCH_STATES.caption,
  rulesIndependentlyVerified:false,performanceAudited:false,
  operationalRobotChangesAllowed:false,autoTraderSignalAllowed:false,
  outstanding:isNew?frozen(['SOURCE_METADATA','SOURCE_CAPTIONS','FULL_RULE_DEFINITION','RISK_LIMITS','VISUAL_CONTEXT','LEGAL_USE']):
   kind===VIDEO_RESEARCH_STATES.caption?frozen(['VISUAL_CONTEXT','METHODOLOGY_INDEPENDENCE','RISK_LIMITS','OOS','PROSPECTIVE']):
   kind===VIDEO_RESEARCH_STATES.playlist?frozen(['PLAYLIST_ITEM_ENUMERATION','SOURCE_METADATA','SOURCE_CAPTIONS']):
   frozen(['SOURCE_CAPTIONS','VISUAL_CONTEXT','FULL_RULE_DEFINITION'])
 });
}));
export const B277_SOURCE_COUNTS=frozen({
 references:B277_EVIDENCE_INVENTORY.length,
 newPending:B277_EVIDENCE_INVENTORY.filter(x=>x.status===VIDEO_RESEARCH_STATES.pending).length,
 priorCaptionNotes:B277_EVIDENCE_INVENTORY.filter(x=>x.status===VIDEO_RESEARCH_STATES.caption).length,
 metadataOnly:B277_EVIDENCE_INVENTORY.filter(x=>x.status===VIDEO_RESEARCH_STATES.metadata).length,
 pendingPlaylists:B277_EVIDENCE_INVENTORY.filter(x=>x.status===VIDEO_RESEARCH_STATES.playlist).length,
 newlyVerifiedTranscripts:0,independentStrategyValidations:0,approvedTradingRules:0
});
export function reviewB277VideoSource(id){
 if(typeof id!=='string'||!id.trim())throw Error('B277_VIDEO_ID_REQUIRED');
 const row=B277_EVIDENCE_INVENTORY.find(x=>x.videoId===id);
 if(!row)throw Error('B277_UNREGISTERED_VIDEO');
 return row;
}
export function technicalEvidenceGate(videoId){
 const r=reviewB277VideoSource(videoId);
 return frozen({
  videoId:r.videoId,notesCanSupportOriginalEducationalSummary:r.existingCaptionNotesAvailable,
  newVideoContentVerified:r.status!==VIDEO_RESEARCH_STATES.pending&&r.transcriptFetchedInB277,
  modelCanCiteNewVideoAsReviewed:false,
  canExtractOperationalSetup:false,canChangeRobot:false,canSendOrder:false,
  requires:frozen([...r.outstanding]),
  message:'Materiais não auditados não autorizam novos parâmetros, alertas operacionais ou resultados prometidos.'
 });
}
