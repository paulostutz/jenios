export const SPECIALIST_FIELDS='user_id,nome,cargo,especialidades,experiencia,certificacoes,youtube,sobre,updated_at';
export function specialistDetails(value) {
  try{const data=JSON.parse(value);if(data?.schema==='jenios-specialist-v1')return {about:String(data.about||''),public:data.public===true,offers:Array.isArray(data.offers)?data.offers:[]};}catch{}
  return {about:String(value||''),public:false,offers:[]};
}
export function validateSpecialist(input){
  if(!input||typeof input!=='object')throw new Error('Perfil inválido.');
  const result={};
  for(const key of ['nome','cargo','especialidades','experiencia','certificacoes','youtube']){
    const value=String(input[key]||'').trim();if(value.length>(key==='experiencia'?1200:300))throw new Error('Campo muito longo: '+key);result[key]=value;
  }
  if(result.youtube){const url=new URL(result.youtube);if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','youtu.be'].includes(url.hostname)||url.username||url.password)throw new Error('Use um link HTTPS do YouTube.');}
  const about=String(input.about||'').trim();if(about.length>1200)throw new Error('Apresentação muito longa.');
  if(input.public===true&&!result.nome)throw new Error('Informe o nome profissional antes de publicar.');
  const offers=input.offers||[];if(!Array.isArray(offers)||offers.length>10)throw new Error('Use até dez serviços.');
  const cleanOffers=offers.map(offer=>{
    if(!/^[0-9a-f-]{36}$/i.test(offer.id||''))throw new Error('Identificador da oferta inválido.');
    if(!['mentoria','estrategia','conteudo','copy'].includes(offer.kind))throw new Error('Tipo de oferta inválido.');
    const title=String(offer.title||'').trim(),description=String(offer.description||'').trim();
    if(!title||title.length>100||description.length>600)throw new Error('Informe título e descrição válidos.');
    if(!Number.isSafeInteger(offer.price_cents)||offer.price_cents<100||offer.price_cents>10000000)throw new Error('Preço da oferta inválido.');
    return {id:offer.id,kind:offer.kind,title,description,price_cents:offer.price_cents};
  });
  if(new Set(cleanOffers.map(offer=>offer.id)).size!==cleanOffers.length)throw new Error('Ofertas duplicadas.');
  return {...result,sobre:JSON.stringify({schema:'jenios-specialist-v1',about,public:input.public===true,offers:cleanOffers})};
}
export function publicSpecialist(row){
  const details=specialistDetails(row.sobre);if(!details.public)return null;
  return {user_id:row.user_id,nome:row.nome,cargo:row.cargo,especialidades:row.especialidades,experiencia:row.experiencia,certificacoes:row.certificacoes,youtube:row.youtube,...details,updated_at:row.updated_at};
}
