import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,CURRICULUM_VERSION} from '../lib/learning/catalog.mjs';
import {validateUniversityMilestoneEvidence,universityMilestoneSnapshot} from '../lib/email/university-milestone-evidence.mjs';

const completed=LESSONS.slice(0,10).map(x=>x.id);
const row={
 event_kind:'university_milestone',user_id:'u1',
 reference_key:'u1:university:lessons:10',
 payload:{milestoneKey:'lessons-10',curriculumVersion:CURRICULUM_VERSION,
  completedLessons:10,totalLessons:15,completedTracks:3,totalTracks:5}
};
const learning={user_id:'u1',revision:11,state:{version:CURRICULUM_VERSION,completedLessons:completed}};

test('B305-R28 University evidence revalidates persisted official progress',()=>{
 assert.equal(validateUniversityMilestoneEvidence(row,learning),true);
 assert.equal(validateUniversityMilestoneEvidence({...row,reference_key:'u1:university:lessons:15'},learning),false);
 assert.equal(validateUniversityMilestoneEvidence({...row,payload:{...row.payload,completedLessons:15}},learning),false);
 assert.equal(validateUniversityMilestoneEvidence({...row,payload:{...row.payload,curriculumVersion:'legacy'}},learning),false);
});

test('B305-R28 unknown and duplicate lesson ids never inflate progress',()=>{
 const snapshot=universityMilestoneSnapshot({version:CURRICULUM_VERSION,completedLessons:['fake',...completed.slice(0,5),completed[0],completed[1]]});
 assert.equal(snapshot.completedLessons,5);
 const fake={...learning,state:{version:CURRICULUM_VERSION,completedLessons:['x1','x2','x3','x4','x5','x6','x7','x8','x9','x10']}};
 assert.equal(validateUniversityMilestoneEvidence(row,fake),false);
});
