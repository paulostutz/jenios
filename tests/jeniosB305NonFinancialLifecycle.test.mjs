import test from 'node:test';
import assert from 'node:assert/strict';
import {universityMilestoneEmail,monthlyAccountSummaryEmail,serviceNoticeEmail,npsEmail} from '../lib/email/lifecycle-campaigns.mjs';

const INTERNAL=/(?:\bB\d{3}\b|\bR\d{1,3}\b|\bQA\b|homologa(?:c|ç)[aã]o)/i;
const publicCopy=message=>{
 for(const value of [message.subject,message.html,message.text||''])assert.doesNotMatch(String(value),INTERNAL);
 assert.match(message.html,/jenios-logo-horizontal\.webp/);
};

test('B305-R22 University milestone only accepts bounded persisted progress',()=>{
 const message=universityMilestoneEmail({userId:'u1',to:'aluno@example.com',customerName:'Aluno',
  milestoneKey:'all-tracks',completedLessons:15,totalLessons:15,completedTracks:5,totalTracks:5,streakDays:8});
 publicCopy(message);assert.match(message.subject,/concluiu todas as trilhas/);
 assert.match(message.html,/15/);assert.match(message.html,/5/);
 assert.throws(()=>universityMilestoneEmail({userId:'u1',to:'a@b.com',milestoneKey:'x',completedLessons:16,totalLessons:15,completedTracks:5,totalTracks:5}),/UNIVERSITY_MILESTONE_INVALID/);
});

test('B305-R22 monthly summary refuses invented financial value',()=>{
 const message=monthlyAccountSummaryEmail({userId:'u1',periodKey:'2026-10',to:'cliente@example.com',studyDays:12,completedLessons:4,reviews:9,verifiedRiskBlocks:null});
 publicCopy(message);assert.match(message.html,/Sem fonte de corretora verificada/);
 assert.doesNotMatch(message.html,/lucro evitado.*R\$|rentabilidade|ganho garantido/i);
});

test('B305-R22 service notice only links to JENIOS-owned destination',()=>{
 const message=serviceNoticeEmail({noticeId:'maintenance-1',to:'cliente@example.com',title:'Manutenção programada',summary:'Alguns recursos poderão ficar temporariamente indisponíveis.',actionUrl:'/status'});
 publicCopy(message);assert.match(message.html,/https:\/\/www\.jenios\.com\.br\/status/);
 assert.throws(()=>serviceNoticeEmail({noticeId:'x',to:'cliente@example.com',title:'x',summary:'y',actionUrl:'https://evil.example'}),/SERVICE_NOTICE_URL_INVALID/);
});

test('B305-R22 NPS requires HTTPS and carries no internal release marker',()=>{
 const message=npsEmail({surveyId:'survey-1',to:'cliente@example.com',customerName:'Cliente',surveyUrl:'https://forms.example.com/nps'});
 publicCopy(message);assert.match(message.html,/Responder pesquisa/);
 assert.throws(()=>npsEmail({surveyId:'survey-1',to:'cliente@example.com',surveyUrl:'http://forms.example.com/nps'}),/NPS_URL_INVALID/);
});
