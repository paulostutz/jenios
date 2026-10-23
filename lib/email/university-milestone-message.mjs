import {validateUniversityMilestoneEvidence} from './university-milestone-evidence.mjs';
import {universityMilestoneEmail} from './lifecycle-campaigns.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildUniversityMilestoneMessage({row,learning,to,customerName='Aluno JENIOS'}={}){
 const email=String(to||'').trim().toLowerCase();
 if(!EMAIL.test(email))throw Object.assign(Error('UNIVERSITY_RECIPIENT_INVALID'),{code:'UNIVERSITY_RECIPIENT_INVALID'});
 if(!validateUniversityMilestoneEvidence(row,learning))
  throw Object.assign(Error('UNIVERSITY_MILESTONE_EVIDENCE_INVALID'),{code:'UNIVERSITY_MILESTONE_EVIDENCE_INVALID'});
 const payload=row.payload;
 return universityMilestoneEmail({
  userId:row.user_id,
  to:email,
  customerName,
  milestoneKey:payload.milestoneKey,
  completedLessons:Number(payload.completedLessons),
  totalLessons:Number(payload.totalLessons),
  completedTracks:Number(payload.completedTracks),
  totalTracks:Number(payload.totalTracks),
  streakDays:0
 });
}
