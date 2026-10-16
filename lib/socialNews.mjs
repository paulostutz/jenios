// Classificação temática do título; não prevê preço nem recomenda operações.
export function classifyNews(title) {
  const text = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return [
    [/\b(acao|acoes|bolsa|ibovespa|ibov|nasdaq|s&p|dow jones|petr[34]|vale3)\b/, 'Ações e índices'],
    [/\b(dolar|cambio|euro|real)\b/, 'Câmbio'],
    [/\b(juros|selic|inflacao|copom|fed|ipca)\b/, 'Juros e inflação'],
    [/\b(petroleo|ouro|minerio|soja|commodities)\b/, 'Commodities'],
    [/\b(lucro|receita|dividendos|balanco|resultados)\b/, 'Resultados corporativos'],
    [/\b(bitcoin|cripto|criptomoedas|ethereum|tokens)\b/, 'Criptoativos'],
  ].filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}
function decode(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]*>/g, '').trim();
}
function field(item, name) {
  return decode(item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1] || '');
}
export function parseNewsRSS(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap(([, item]) => {
    const titulo = field(item, 'title'), url = field(item, 'link');
    if (!titulo || !/^https:\/\//i.test(url)) return [];
    const timestamp = Date.parse(field(item, 'pubDate'));
    return [{titulo:titulo.slice(0,180), url, fonte:field(item,'source'), categorias:classifyNews(titulo), publicadoEm:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null}];
  });
}
export async function loadNews({fetchImpl=fetch}={}) {
  const urls=[
    'https://news.google.com/rss/search?q=mercado+financeiro+economia+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    'https://news.google.com/rss/search?q=bolsa+juros+dolar+economia&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  ];
  const responses=await Promise.allSettled(urls.map(async url=>{
    const response=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(9000),headers:{'User-Agent':'JENIOS-Social/2.0'}});
    if (!response.ok) throw Error('RSS_UNAVAILABLE');
    return parseNewsRSS(await response.text());
  }));
  const noticias=[...new Map(responses.flatMap(result=>result.status==='fulfilled'?result.value:[]).map(item=>[item.url,item])).values()].sort((a,b)=>Date.parse(b.publicadoEm||0)-Date.parse(a.publicadoEm||0)).slice(0,8);
  return {noticias, atualizadoEm:new Date().toISOString(), fonte:'Google News RSS — links de veículos externos', disponivel:noticias.length>0};
}
