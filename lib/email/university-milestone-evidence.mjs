import {CURRICULUM_VERSION,LESSONS,TRACKS} from '../learning/catalog.mjs';

function progress(state){
 if(!state||state.version!==CURRICULUM_VERSION||!Array.isArray(state.completedLessons))return null;
 const known=new Set(LESSONS.map(lesson=>lesson.id));
 const completed=[...new Set(state.completedLessons.filter(id=>known.has(id)))];
 const completedSet=new Set(completed);
 const completedTracks=TRACKS.filter(track=>
  LESSONS.filter(lesson=>lesson.trackId===track.id).every(lesson=>completedSet.has(lesson.id))
 ).length;
 return Object.freeze({
  completedLessons:completed.length,totalLessons:LESSONS.length,
  completedTracks,totalTracks:TRACKS.length
 });
}

export function validateUniversityMilestoneEvidence(row,learning){
 if(row?.event_kind!=='university_milestone'||learning?.user_id!==row.user_id)return false;
 const payload=row?.payload;
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   payload.curriculumVersion!==CURRICULUM_VERSION)return false;
 const match=String(payload.milestoneKey||'').match(/^lessons-(5|10|15)$/);
 if(!match)return false;
 const threshold=Number(match[1]);
 if(row.reference_key!==row.user_id+':university:lessons:'+threshold)return false;
 const current=progress(learning.state);
 const snapshotLessons=Number(payload.completedLessons);
 const snapshotTracks=Number(payload.completedTracks);
 return Boolean(current&&Number.isSafeInteger(snapshotLessons)&&Number.isSafeInteger(snapshotTracks)&&
  snapshotLessons>=threshold&&snapshotLessons<=current.completedLessons&&
  Number(payload.totalLessons)===current.totalLessons&&
  Number(payload.totalTracks)===current.totalTracks&&
  snapshotTracks>=0&&snapshotTracks<=current.completedTracks);
}

export function universityMilestoneSnapshot(state){
 return progress(state);
}
