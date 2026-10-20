/** Click-to-chat format: https://faq.whatsapp.com/5913398998672934 */
export const WHATSAPP_COUNTRIES=Object.freeze([
 ['BR','Brasil','55'],['PT','Portugal','351'],['US','Estados Unidos','1'],['AR','Argentina','54'],['AU','Austrália','61'],['AT','Áustria','43'],['BE','Bélgica','32'],['BO','Bolívia','591'],['CA','Canadá','1'],['CL','Chile','56'],['CN','China','86'],['CO','Colômbia','57'],['KR','Coreia do Sul','82'],['CR','Costa Rica','506'],['CU','Cuba','53'],['DK','Dinamarca','45'],['EC','Equador','593'],['EG','Egito','20'],['SV','El Salvador','503'],['AE','Emirados Árabes','971'],['ES','Espanha','34'],['FI','Finlândia','358'],['FR','França','33'],['DE','Alemanha','49'],['GR','Grécia','30'],['GT','Guatemala','502'],['HN','Honduras','504'],['IN','Índia','91'],['ID','Indonésia','62'],['IE','Irlanda','353'],['IL','Israel','972'],['IT','Itália','39'],['JP','Japão','81'],['LU','Luxemburgo','352'],['MX','México','52'],['MZ','Moçambique','258'],['AO','Angola','244'],['CV','Cabo Verde','238'],['NI','Nicarágua','505'],['NO','Noruega','47'],['NZ','Nova Zelândia','64'],['NL','Países Baixos','31'],['PA','Panamá','507'],['PY','Paraguai','595'],['PE','Peru','51'],['PL','Polônia','48'],['GB','Reino Unido','44'],['DO','República Dominicana','1'],['SE','Suécia','46'],['CH','Suíça','41'],['ZA','África do Sul','27'],['TR','Turquia','90'],['UY','Uruguai','598'],['VE','Venezuela','58'],['OTHER','Outro país','']
].map(([code,name,ddi])=>Object.freeze({code,name,ddi})));
export function whatsappDestination(countryCode,nationalNumber,customDdi=''){
 const country=WHATSAPP_COUNTRIES.find(x=>x.code===countryCode);
 if(!country)throw Error('Selecione o país do WhatsApp.');
 const ddi=country.code==='OTHER'?String(customDdi).trim():country.ddi;
 if(!/^[1-9]\d{0,3}$/.test(ddi))throw Error('Informe o DDI do país, sem o sinal +.');
 const raw=String(nationalNumber||'').trim();
 if(!/^[\d\s().-]+$/.test(raw))throw Error('Informe somente o DDD e o telefone, sem DDI ou link.');
 const number=raw.replace(/\D/g,'');
 if(country.code==='BR'&&!/^[1-9]\d{9,10}$/.test(number))throw Error('No Brasil, informe DDD + telefone, com 10 ou 11 dígitos, sem repetir o 55.');
 if(number.length<6||!number.match(/[1-9]/)||!new RegExp('^[1-9]\\d{7,14}$').test(ddi+number))throw Error('Confira o número completo com o código de área, sem repetir o DDI.');
 return 'https://wa.me/'+ddi+number;
}
