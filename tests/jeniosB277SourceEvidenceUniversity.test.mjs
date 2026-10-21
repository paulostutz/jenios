import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRACKS,LESSONS} from '../lib/learning/catalog.mjs';
import {STUDY_GUIDES} from '../lib/learning/trade-study-guides.mjs';
import {PRACTICAL_STUDY_WORKSHOPS} from '../lib/learning/trade-study-workshops-b271.mjs';
import {LESSON_VISUAL_SCENES,WORKSHOP_TO_LESSON_SCENE} from '../lib/learning/lesson-visual-scenes-b276.mjs';
import {SUPPLEMENTAL_TRADE_VIDEO_IDS} from '../lib/learning/trade-video-supplement-20261021.mjs';
import {USER_VIDEO_RESOURCES} from '../lib/learning/trade-video-resources.mjs';
import {B277_EVIDENCE_INVENTORY,B277_SOURCE_COUNTS,VIDEO_RESEARCH_STATES,reviewB277VideoSource,technicalEvidenceGate} from '../lib/learning/b277-video-evidence.mjs';
import {B277_GUIDED_STUDIES,B277_INDEPENDENT_EDUCATIONAL_LINKS,b277StudiesForTrack,b277ExternalLinksForCase} from '../lib/learning/b277-guided-trade-studies.mjs';

test('B277 catalog still has 56 sources, 36 unverified new videos, 13 prior caption notes and 3 playlists',()=>{
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 assert.equal(new Set(USER_VIDEO_RESOURCES.map(r=>r.id)).size,56);
 assert.deepEqual(B277_SOURCE_COUNTS,{
  references:56,newPending:36,priorCaptionNotes:13,
  metadataOnly:4,pendingPlaylists:3,newlyVerifiedTranscripts:0,
  independentStrategyValidations:0,approvedTradingRules:0
 });
 assert.equal(B277_EVIDENCE_INVENTORY.length,56);
 assert.equal(new Set(B277_EVIDENCE_INVENTORY.map(x=>x.videoId)).size,56);
});
test('B277 36 new records keep neutral titles, unknown authors, no source transcripts and no operational methods',()=>{
 const videoIds=new Set(SUPPLEMENTAL_TRADE_VIDEO_IDS);
 assert.equal(videoIds.size,36);
 const raw=USER_VIDEO_RESOURCES.filter(x=>videoIds.has(x.id));
 assert.equal(raw.length,36);
 for(const resource of raw){
  assert.equal(resource.verification,'needs_video_review');
  assert.equal(resource.channel,null);
  const r=reviewB277VideoSource(resource.id),gate=technicalEvidenceGate(resource.id);
  assert.equal(r.status,VIDEO_RESEARCH_STATES.pending);
  assert.equal(r.sourceTitle,null);assert.equal(r.sourceChannel,null);
  assert.equal(r.existingCaptionNotesAvailable,false);
  assert.equal(r.transcriptFetchedInB277,false);
  assert.equal(r.rulesIndependentlyVerified,false);
  assert.equal(r.operationalRobotChangesAllowed,false);
  assert.equal(gate.newVideoContentVerified,false);
  assert.equal(gate.modelCanCiteNewVideoAsReviewed,false);
  assert.equal(gate.canChangeRobot,false);
  assert.equal(gate.canExtractOperationalSetup,false);
  assert.equal(gate.canSendOrder,false);
  assert.ok(gate.requires.includes('SOURCE_CAPTIONS'));
  assert.ok(gate.requires.includes('RISK_LIMITS'));
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(gate));
 }
});
test('B277 cannot treat previous metadata-only material or unlisted IDs as transcribed',()=>{
 const metadata=USER_VIDEO_RESOURCES.filter(x=>x.verification.startsWith('metadata_verified'));
 assert.equal(metadata.length,4);
 for(const r of metadata){
  const q=reviewB277VideoSource(r.id),gate=technicalEvidenceGate(r.id);
  assert.equal(q.status,VIDEO_RESEARCH_STATES.metadata);
  assert.equal(q.existingCaptionNotesAvailable,false);
  assert.equal(gate.notesCanSupportOriginalEducationalSummary,false);
  assert.equal(gate.canChangeRobot,false);
 }
 assert.throws(()=>reviewB277VideoSource('UNKNOWN_SOURCE'),/B277_UNREGISTERED_VIDEO/);
 assert.throws(()=>technicalEvidenceGate(''),/B277_VIDEO_ID_REQUIRED/);
 assert.throws(()=>technicalEvidenceGate(null),/B277_VIDEO_ID_REQUIRED/);
});
test('B277 13 guided sources are exactly the previously reviewed captions and are not new source claims',()=>{
 assert.equal(B277_GUIDED_STUDIES.length,13);
 assert.equal(new Set(B277_GUIDED_STUDIES.map(x=>x.id)).size,13);
 const prior=USER_VIDEO_RESOURCES.filter(x=>x.verification==='transcript_reviewed');
 assert.deepEqual(B277_GUIDED_STUDIES.map(x=>x.videoId).sort(),prior.map(x=>x.id).sort());
 const supplemental=new Set(SUPPLEMENTAL_TRADE_VIDEO_IDS);
 for(const c of B277_GUIDED_STUDIES){
  assert.equal(supplemental.has(c.videoId),false);
  assert.equal(c.evidence,'PREVIOUS_CHECKPOINT_CAPTION_NOTES_NOT_RECHECKED_B277');
  assert.equal(c.profitabilityVerified,false);
  assert.equal(c.authorEndorsementVerified,false);
  assert.equal(c.videoScreenReviewed,false);
  assert.equal(c.robotChangesPermitted,false);
 }
});
test('B277 case studies are complete, self-explanatory and still optional across five existing tracks',()=>{
 assert.deepEqual(new Set(B277_GUIDED_STUDIES.map(x=>x.trackId)),new Set(TRACKS.map(x=>x.id)));
 for(const c of B277_GUIDED_STUDIES){
  assert.ok(c.title.length>18&&c.explanation.length>70);
  assert.ok(c.observation.length>55&&c.example.length>65);
  assert.ok(c.check.length>30&&c.limitation.length>55);
  assert.equal(c.steps.length,3);
  assert.ok(c.steps.every(x=>x.length>36));
  assert.ok(c.researchFields.length>=4);
  assert.ok(c.externalLinkIds.length>=1);
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.steps));
 }
 assert.equal(b277StudiesForTrack('fundamentos').length,1);
 assert.equal(b277StudiesForTrack('graficos').length,3);
 assert.equal(b277StudiesForTrack('execucao').length,2);
 assert.equal(b277StudiesForTrack('estrategias').length,5);
 assert.equal(b277StudiesForTrack('laboratorio').length,2);
 assert.deepEqual(b277StudiesForTrack('unknown'),[]);
});
test('B277 independent educational links are allowlisted public non-trading sources',()=>{
 const hosts=new Set(['www.cmegroup.com','www.investor.gov','www.cfainstitute.org']);
 assert.equal(B277_INDEPENDENT_EDUCATIONAL_LINKS.length,8);
 for(const link of B277_INDEPENDENT_EDUCATIONAL_LINKS){
  const url=new URL(link.url);assert.equal(url.protocol,'https:');
  assert.ok(hosts.has(url.hostname));assert.ok(!url.username&&!url.password&&!url.hash);
 }
 for(const study of B277_GUIDED_STUDIES){
  const links=b277ExternalLinksForCase(study);
  assert.equal(links.length,study.externalLinkIds.length);
  for(const link of links)assert.ok(study.externalLinkIds.includes(link.id));
 }
 assert.deepEqual(b277ExternalLinksForCase(null),[]);
});
test('B277 education additions do not replace fifteen lessons, old guides, B271 workshops or B276 diagrams',()=>{
 assert.equal(TRACKS.length,5);
 assert.equal(LESSONS.length,15);
 assert.equal(STUDY_GUIDES.length,5);
 assert.equal(PRACTICAL_STUDY_WORKSHOPS.length,10);
 assert.equal(Object.keys(LESSON_VISUAL_SCENES).length,15);
 assert.equal(Object.keys(WORKSHOP_TO_LESSON_SCENE).length,10);
});
test('B277 University renders optional case studies and explicit warnings without paid AI or quiz gates',()=>{
 const src=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/components/learning/LearningRoom.module.css',import.meta.url),'utf8');
 assert.match(src,/B277_GUIDED_STUDIES/);
 assert.match(src,/sourceStudies\.map/);
 assert.match(src,/aria-label="Estudos de fontes revisadas"/);
 assert.match(src,/Da referência ao método: estude com evidências/);
 assert.match(src,/B277_SOURCE_COUNTS\.newPending/);
 assert.match(src,/não foram certificados/i);
 assert.match(src,/b277ExternalLinksForCase/);
 assert.match(src,/nenhuma técnica é liberada para os robôs/i);
 assert.match(src,/<LessonVisual lessonId=\{lesson\.id\}\/>/);
 assert.match(src,/<LessonVisual workshopId=\{w\.id\}\/>/);
 assert.doesNotMatch(src,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
 assert.match(css,/\.sourceStudySteps/);assert.match(css,/\.sourceStudyLinks/);
});
test('B277 new modules contain no network requests, fake live trading data, payment routines or source promotion flags',()=>{
 const paths=[
  '../lib/learning/b277-video-evidence.mjs',
  '../lib/learning/b277-guided-trade-studies.mjs'
 ];
 for(const path of paths){
  const src=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(src,/\bfetch\s*\(|\bXMLHttpRequest\b|\bprocess\.env\b|api\.alpaca\.markets|api\.binance\.com/);
  assert.doesNotMatch(src,/\bcreateOrder\b|\bsubmitOrder\b|\bcheckout\b|\bpaymentIntent\b/);
 }
});
