/** Identidades editoriais. Não disponibilizar fallback de slogan entre produtos. */
export const PLATFORM_SLOGAN = 'A Plataforma Que Transforma o Seu Erro Em Lucro';
// A frase oficial da Social não foi localizada em fonte confirmada pelo proprietário.
// Mantemos null para impedir a publicação de um slogan inventado ou emprestado da Platform.
export const SOCIAL_SLOGAN = null;
export const BRAND_IDENTITIES = Object.freeze({
  platform: Object.freeze({id:'platform',name:'JENIOS Platform',slogan:PLATFORM_SLOGAN,confirmed:true}),
  social: Object.freeze({id:'social',name:'JENIOS Social',slogan:SOCIAL_SLOGAN,confirmed:false})
});
export const HUMAN_MASCOTS = Object.freeze([
  Object.freeze({id:'genio',name:'Gênio',image:'/assistentes/genio.webp'}),
  Object.freeze({id:'genia',name:'Gênia',image:'/assistentes/genia.webp'})
]);
export function mascotAt(position){
  if(!Number.isSafeInteger(position)||position<0)throw new TypeError('posição inválida');
  return HUMAN_MASCOTS[position % HUMAN_MASCOTS.length];
}
export function identityFor(channel){
  if(!Object.hasOwn(BRAND_IDENTITIES,channel))throw new TypeError('produto inválido');
  return BRAND_IDENTITIES[channel];
}
export function prepareEditorialPost({channel,position,title,body}){
  const brand=identityFor(channel),mascot=mascotAt(position);
  if(typeof title!=='string'||!title.trim()||typeof body!=='string'||!body.trim())throw new TypeError('conteúdo vazio');
  const ready=brand.confirmed&&Boolean(brand.slogan);
  return Object.freeze({channel,brand:brand.name,title:title.trim(),body:body.trim(),slogan:brand.slogan,mascot,
    status:ready?'draft_review':'awaiting_social_slogan',
    // Mesmo em Platform, é somente rascunho editorial; publicar exige revisão humana.
    publishableAfterReview:ready});
}
