import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,CURRICULUM_VERSION} from '../lib/learning/catalog.mjs';
import {buildUniversityMilestoneMessage} from '../lib/email/university-milestone-message.mjs';

const completed=LESSONS.slice(0,10).map(x=>x.id);
const row={
 event_kind:'university_milestone',user_id:'u1',
 reference_key:'u1:university:lessons:10',
 payload:{milestoneKey:'lessons-10',curriculumVersion:CURRICULUM_VERSION,
  completedLessons:10,totalLessons:15,completedTracks:3,totalTracks:5}
};
const learning={user_id:'u1',revision:11,state:{version:CURRICULUM_VERSION,completedLessons:completed}};

test('B305-R29 pure adapter builds branded University message only after evidence validation',()=>{
 const message=buildUniversityMilestoneMessage({row,learning,to:'Aluno@example.com',customerName:'Aluno'});
 assert.equal(message.to,'aluno@example.com');
 assert.match(message.subject,/Universidade/);
 assert.match(message.html,/jenios-logo-horizontal\.webp/);
 assert.match(message.html,/10/);
 assert.doesNotMatch(message.html,/0 dia\(s\)/);
 assert.doesNotMatch(message.html,/\bQA\b|homologa[cç][aã]o|\bB305\b|\bR29\b/i);
});

test('B305-R29 pure adapter rejects unverified progress and invalid recipient',()=>{
 assert.throws(()=>buildUniversityMilestoneMessage({
  row:{...row,payload:{...row.payload,completedLessons:15}},learning,to:'aluno@example.com'
 }),/UNIVERSITY_MILESTONE_EVIDENCE_INVALID/);
 assert.throws(()=>buildUniversityMilestoneMessage({row,learning,to:'invalid'}),/UNIVERSITY_RECIPIENT_INVALID/);
});
