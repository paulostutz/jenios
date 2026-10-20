import {CONNECTION_GUIDES,CONNECTION_SAFETY,connectionGuide,guideHref} from './catalog.mjs';
export const normalizeConnectionText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** Never echo a potential credential, and never send it to external AI. */
export function connectionSecret(text){
 if(typeof text!=='string')return false;
 return /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|sb_secret)[-_][A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.|(?:api[ _-]?key|api[ _-]?secret|secret[ _-]?key|private[ _-]?key|client[ _-]?secret|access[ _-]?token|refresh[ _-]?token|senha|password|frase[ _-]?semente|seed[ _-]?phrase)\s*[:=]\s*\S{6,}|\b[A-Za-z0-9_+/=-]{48,}\b)/i.test(text);
}
const article=(g,text)=>({id:'connection-'+g.id,title:'Como conectar: '+g.name,tags:g.aliases,text,href:guideHref(g.id)});
export function connectionGuideText(g){return [g.name+' — '+g.status+'.',g.method,...g.steps.map((s,i)=>(i+1)+'. '+s.title+': '+s.text),'Para revogar: '+g.revocation,'Documentação revisada em '+g.reviewedAt+'. Fontes oficiais no guia.',CONNECTION_SAFETY].join('\n\n');}
export function connectionHelpFor(message){
 const q=normalizeConnectionText(message);if(!q)return [];
 if(connectionSecret(message))return [{id:'connection-security',title:'Proteja suas credenciais',href:'/integracoes',text:'Não envie credenciais ao atendimento. Não repetirei o conteúdo informado. Se uma chave real foi exposta, revogue-a no fornecedor e revise os acessos. Revogar uma chave não cancela ordens nem encerra posições. Nenhuma conta foi conectada.'}];
 const matches=CONNECTION_GUIDES.map(g=>({g,score:Math.max(0,...g.aliases.map(a=>(' '+q+' ').includes(' '+normalizeConnectionText(a)+' ')?normalizeConnectionText(a).length:0))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 const integration=/\b(api|apis|integracao|integracoes|conectar|conexao|conexoes|corretora|corretoras|credenciais|chave|chaves|terminal|plataformas|oauth|passo a passo|autorizacao)\b/.test(q);
 if(!matches.length){if(!integration)return [];return [{id:'connection-overview',title:'Central de conexões e guias',href:'/integracoes',text:'A JENIOS reúne guias de Binance Spot, Profit/Nelogica, Genial, Clear, XP, BTG, MetaTrader 5, cTrader, Interactive Brokers, Alpaca, Mercado Bitcoin e Kraken. Informe qual fornecedor deseja conectar. O guia distingue licença, autorização da conta e validação técnica; não há aprovação universal de todas as corretoras. Nenhuma conta externa foi conectada por este atendimento. '+CONNECTION_SAFETY}];}
 if(matches.length>1&&/\b(todas|todos|comparar|diferenca|versus)\b|\be\b/.test(q)&&integration){return matches.slice(0,3).map(({g})=>article(g,g.name+': '+g.method+' Situação: '+g.status+'. Abra o guia específico para os passos e as fontes. '+CONNECTION_SAFETY));}
 const g=matches[0].g;
 if(/\b(erro|falha|problema|invalida|invalido|unauthorized|451|403|nonce)\b|nao consigo|nao conecta|nao aparece/.test(q))return [article(g,g.name+' — diagnóstico orientado, sem acesso à sua conta.\n\n'+g.troubleshooting.map(x=>x.problem+': '+x.solution).join('\n\n')+'\n\n'+CONNECTION_SAFETY)];
 if(/\b(revogar|revogacao|desconectar|remover|excluir|cancelar acesso)\b/.test(q))return [article(g,g.revocation+' '+CONNECTION_SAFETY)];
 return [article(g,connectionGuideText(g))];
}
export function preparationChecklist(provider,answers){
 const g=connectionGuide(provider);if(!g)throw Error('UNKNOWN_PROVIDER');
 if(!answers||typeof answers!=='object'||Array.isArray(answers)||Object.keys(answers).some(k=>!g.steps.some(s=>s.id===k))||Object.values(answers).some(v=>typeof v!=='boolean'))throw Error('INVALID_CHECKLIST');
 const complete=g.steps.filter(s=>answers[s.id]).length;
 return {provider:g.id,complete,total:g.steps.length,guideReviewed:complete===g.steps.length,accountVerified:false,connected:false,liveExecution:false,credentialsStored:false,message:complete===g.steps.length?'Etapas de leitura marcadas. Isso não confirma conexão, permissões ou negociação.':'Confira os passos do guia. Não envie credenciais.'};
}
