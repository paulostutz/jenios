export function parseBRLInput(raw){
 if(typeof raw!=='string')return null;
 const text=raw.replace(/^\s*R\$\s*/,'').trim();
 if(!text||! /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(text))return null;
 const value=Number(text.replace(/\./g,'').replace(',','.'));
 return Number.isFinite(value)&&value>=0&&value<=100000000?value:null;
}
export function formatBRLInput(value){
 return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(Number(value))?Number(value):0);
}
export function formatBRLEdit(raw){
 const text=raw.replace(/^\s*R\$\s*/,'').trim();
 if(parseBRLInput(text)===null)return text;
 const [whole,fraction]=text.split(',');
 const grouped=whole.replace(/\./g,'').replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 return grouped+(fraction===undefined?'':','+fraction);
}
