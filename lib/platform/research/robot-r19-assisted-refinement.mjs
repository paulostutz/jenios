export function operatorAlignmentGuard({operatorSide,technicalSide,confidence}={}){
 if(![null,'buy','sell'].includes(operatorSide)||![null,'buy','sell'].includes(technicalSide)||
   typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1)
   throw Error('R19_INVALID_ALIGNMENT_INPUT');
 if(operatorSide&&technicalSide&&operatorSide===technicalSide&&confidence>=0.65)
   return Object.freeze({aligned:true,intervene:false,reason:'OPERATOR_ALREADY_ALIGNED'});
 if(operatorSide&&technicalSide&&operatorSide!==technicalSide&&confidence>=0.65)
   return Object.freeze({aligned:false,intervene:true,reason:'MATERIAL_DISAGREEMENT'});
 return Object.freeze({aligned:false,intervene:false,reason:'LOW_CONFIDENCE_OR_NO_SIDE'});
}
export function refineAssistedDecision({mode,operatorSide,technicalSide,confidence}={}){
 if(!['hybrid','reverse'].includes(mode))throw Error('R19_INVALID_MODE');
 const g=operatorAlignmentGuard({operatorSide,technicalSide,confidence});
 if(!g.intervene)return Object.freeze({mode,action:'KEEP_OPERATOR_DECISION',suggestedSide:operatorSide,guard:g,ordersSent:0});
 return Object.freeze({mode,action:mode==='hybrid'?'ADVISE_REVIEW':'REVERSE_REFERENCE',suggestedSide:technicalSide,guard:g,ordersSent:0});
}
