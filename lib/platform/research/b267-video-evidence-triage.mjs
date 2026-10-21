/** B267 — porta de pesquisa para materiais recebidos, SEM ler mídia de fonte externa.
 * Não utiliza a rede, altera robôs ou cria ordens. Não aceita alegações do navegador
 * como prova de transcrição, independentemente de flags fornecidas pelo chamador.
 */
import {USER_VIDEO_RESOURCES} from '../../learning/trade-video-resources.mjs';
const evidence=(row)=>Object.freeze({
 videoId:row.id,kind:row.kind,verification:row.verification,
 educationalLinkAvailable:true,
 contentReviewed:row.verification==='transcript_reviewed',
 metadataVerified:row.verification==='transcript_reviewed'||row.verification.startsWith('metadata_verified'),
 methodologyConfirmed:false,independentStudyCertified:false,
 operationalRobotChangesAllowed:false,ordersSent:0,
 originalTradingCoreModified:false,profitabilityCertified:false
});
export function reviewRegisteredVideoEvidence(videoId){
 if(typeof videoId!=='string'||!videoId)throw Error('VIDEO_REFERENCE_REQUIRED');
 const resource=USER_VIDEO_RESOURCES.find(r=>r.id===videoId);
 if(!resource)throw Error('VIDEO_NOT_REGISTERED');
 return evidence(resource);
}
export function summarizeVideoStudyBacklog(){
 const counts={transcriptReviewed:0,metadataOnly:0,pendingVideoReview:0,pendingPlaylists:0};
 for(const r of USER_VIDEO_RESOURCES){
  if(r.verification==='transcript_reviewed')counts.transcriptReviewed++;
  else if(r.verification==='needs_video_review')counts.pendingVideoReview++;
  else if(r.verification==='needs_playlist_review')counts.pendingPlaylists++;
  else counts.metadataOnly++;
 }
 return Object.freeze({schema:'JENIOS_B267_VIDEO_RESEARCH_BACKLOG_V1',references:USER_VIDEO_RESOURCES.length,
  ...counts,researchStage:'EVIDENCE_TRIAGE',
  curriculumMayLinkToSources:true,videoTitlesIndependentlyVerifiedForNewLinks:false,
  needsVerifiedTranscriptsForNewRules:true,
  futureTestsRequired:Object.freeze(['DEFINIR_ENTRADA_SAIDA_STOP','CUSTOS_E_SLIPPAGE','AMOSTRA_FORA_DA_AMOSTRA','REGIME_DE_MERCADO','PROSPECTIVO_INDEPENDENTE']),
  automaticCoreChanges:false,authorizedToSendBrokerOrders:false,
  profitabilityDemonstrated:false});
}
