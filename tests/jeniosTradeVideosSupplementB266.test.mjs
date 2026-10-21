import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPLEMENTAL_TRADE_VIDEO_IDS,SUPPLEMENTAL_TRADE_VIDEO_RESOURCES} from '../lib/learning/trade-video-supplement-20261021.mjs';
import {USER_VIDEO_RESOURCES,resourcesByTrack} from '../lib/learning/trade-video-resources.mjs';
import {reviewRegisteredVideoEvidence,summarizeVideoStudyBacklog} from '../lib/platform/research/b267-video-evidence-triage.mjs';
const YT=/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;
test('B266 new user-provided video links are complete, unique, canonical and not misattributed',()=>{
 assert.equal(SUPPLEMENTAL_TRADE_VIDEO_IDS.length,36);
 assert.equal(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.length,36);
 assert.equal(USER_VIDEO_RESOURCES.length,56);
 assert.equal(new Set(USER_VIDEO_RESOURCES.map(x=>x.id)).size,56);
 assert.ok(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.every(x=>YT.test(x.url)));
 assert.ok(SUPPLEMENTAL_TRADE_VIDEO_RESOURCES.every(x=>x.verification==='needs_video_review'&&
 x.source==='user_submitted_youtube_link'&&x.channel===null&&x.trackId==='biblioteca'));
 assert.equal(resourcesByTrack('biblioteca').length,39); // 36 pending + 3 playlists
});
test('B267 an unreviewed video cannot be promoted to an operational robot technique',()=>{
 const v=reviewRegisteredVideoEvidence('G_nFDmjtlE0');
 assert.equal(v.contentReviewed,false);
 assert.equal(v.methodologyConfirmed,false);
 assert.equal(v.operationalRobotChangesAllowed,false);
 assert.equal(v.originalTradingCoreModified,false);
 assert.equal(v.ordersSent,0);
 assert.throws(()=>reviewRegisteredVideoEvidence('unknown'),/VIDEO_NOT_REGISTERED/);
});
test('B267 catalog distinguishes prior reviewed captions from new pending videos',()=>{
 const stats=summarizeVideoStudyBacklog();
 assert.equal(stats.references,56);
 assert.equal(stats.transcriptReviewed,13);
 assert.equal(stats.pendingVideoReview,36);
 assert.equal(stats.pendingPlaylists,3);
 assert.equal(stats.metadataOnly,4);
 assert.equal(stats.authorizedToSendBrokerOrders,false);
 assert.equal(stats.profitabilityDemonstrated,false);
 assert.equal(stats.futureTestsRequired.length,5);
});
test('B267 University UI lists dynamic count with clearly labeled sources and no quiz gate',()=>{
 const ui=readFileSync(new URL('../app/components/learning/LearningRoom.js',import.meta.url),'utf8');
 assert.match(ui,/allResources\.length/);
 assert.match(ui,/conteúdo a conferir/);
 assert.doesNotMatch(ui,/start_quiz|submit_quiz|QUESTION_BANK|localStorage/);
});
