/** B148: voluntarily declared demographics; never infer age or sex from a profile. */
export const BOOST_SEXES=Object.freeze(['all','female','male','other']);
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function boostDemographicTarget(input={}){
 const has=Object.hasOwn(input,'ageMin')||Object.hasOwn(input,'ageMax')||Object.hasOwn(input,'sex');
 if(!has)return {}; // Keep legacy quote fingerprints and unrestricted campaigns unchanged.
 const min=input.ageMin??null,max=input.ageMax??null,sex=input.sex??'all';
 if(!BOOST_SEXES.includes(sex))fail('Selecione um sexo válido para o público.');
 if((min===null)!==(max===null))fail('Informe as duas idades da faixa etária.');
 if(min!==null&&(!Number.isInteger(min)||!Number.isInteger(max)||min<18||max>120||min>max))fail('A faixa etária deve estar entre 18 e 120 anos, em ordem crescente.');
 return {ageMin:min,ageMax:max,sex};
}
export function boostViewerDemographics(input={}){
 const age=input.age==null||input.age===''?null:input.age;
 const sex=input.sex==null||input.sex===''?'unknown':input.sex;
 if(age!==null&&(!Number.isInteger(age)||age<18||age>120))fail('Informe uma idade de 18 a 120 anos ou deixe em branco.');
 if(!['unknown','female','male','other'].includes(sex))fail('Escolha uma opção válida ou prefira não informar.');
 return {age,sex};
}
export function boostAudienceMatches(target,viewer={}){
 let filter,audience;try{filter=boostDemographicTarget(target);audience=boostViewerDemographics(viewer);}catch{return false;}
 if(filter.ageMin!=null&&(audience.age===null||audience.age<filter.ageMin||audience.age>filter.ageMax))return false;
 if(filter.sex&&filter.sex!=='all'&&filter.sex!==audience.sex)return false;
 return true;
}
