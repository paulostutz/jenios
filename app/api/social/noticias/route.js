import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const URLS=[
 "https://news.google.com/rss/search?q=mercado+financeiro+economia+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
 "https://news.google.com/rss/search?q=bolsa+juros+dolar+economia&hl=pt-BR&gl=BR&ceid=BR:pt-419"
];
function decode(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<[^>]*>/g,"").trim();}
function field(s,n){return decode(s.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i"))?.[1]||"");}
export async function GET(){
 try{
  const results=[];
  for(const url of URLS){
   const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(9000),headers:{"User-Agent":"Mozilla/5.0 JENIOS-Social/2.0"}});
   if(!response.ok)continue;
   const xml=await response.text();
   for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
    const item=m[1],title=field(item,"title"),link=field(item,"link"),date=field(item,"pubDate");
    if(!title||!/^https:\/\//.test(link))continue;
    const timestamp=Date.parse(date);
    results.push({titulo:title.slice(0,180),url:link,publicadoEm:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null});
   }
  }
  const unique=[...new Map(results.map(x=>[x.url,x])).values()].sort((a,b)=>Date.parse(b.publicadoEm||0)-Date.parse(a.publicadoEm||0)).slice(0,8);
  return NextResponse.json({noticias:unique,atualizadoEm:new Date().toISOString(),fonte:"Google News RSS — links de veículos externos",disponivel:unique.length>0},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({noticias:[],disponivel:false,erro:"Fonte de notícias temporariamente indisponível"},{headers:{"Cache-Control":"no-store"}});
 }
}
