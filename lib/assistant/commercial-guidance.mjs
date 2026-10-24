/** Bounded fallback for a commercial conversation; never infers ability to pay.
 * Caller must establish a plans topic before using these responses. */
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function commercialConcern(message){
 const q=fold(message);
 if(/\b(?:sem dinheiro|nao tenho dinheiro|endividado|endividada|pagar dividas|recuperar (?:o que perdi|minhas perdas|perdas|prejuizo)|dinheiro do aluguel)\b/.test(q))return 'hardship';
 if(/\b(?:nao (?:quero|vou|desejo) (?:mais )?(?:assinar|contratar|comprar (?:o |um )?plano)|nao tenho interesse|pare de (?:oferecer|insistir)|nao insista|deixa para la|agora nao|vou pensar|prefiro pensar)\b/.test(q))return 'decline';
 if(/\b(?:caro|cara|caros|caras|desconto|mais barato|menor preco|fora do (?:meu )?orcamento|cabe no (?:meu )?orcamento)\b/.test(q))return 'price';
 if(/\b(?:sem tempo|pouco tempo|nao tenho tempo|rotina corrida)\b/.test(q))return 'time';
 if(/\b(?:confiar|confiavel|confianca|golpe|prova|comprovar|funciona mesmo)\b/.test(q))return 'trust';
 if(/\b(?:complicado|complicada|complexo|complexa|iniciante|nao sei usar|dificil de usar)\b/.test(q))return 'complexity';
 return null;
}

export const CONSULTATIVE_SALES_INSTRUCTIONS='Em conversas comerciais, atue como consultor: identifique o objetivo e a dificuldade que a própria pessoa relatou; não invente dores, perdas nem diagnósticos. Faça no máximo uma pergunta curta por resposta, apenas sobre o que ainda falta saber. Relacione a necessidade a um benefício verificável (estudo, gráficos, diário ou simulação), explique o limite relevante e proponha um próximo passo concreto. Responda diretamente a preço, tempo, complexidade e confiança antes de oferecer outro recurso. Escolha o menor escopo adequado, sem empurrar o plano mais caro; se a pessoa só quer estudar, considere a Universidade separada. Ao haver intenção clara de contratar, informe o preço exato e oriente a conferir disponibilidade e termos no checkout, sem prolongar a qualificação. Não invente desconto, teste grátis, estatísticas, depoimentos, urgência, vagas limitadas, retorno financeiro ou franquias Pro. Não apresente custo diário artificial para minimizar a mensalidade. Respeite recusa e pedido de cancelamento; não faça nova oferta nem retenção forçada. Se a pessoa relata dívidas ou pretende recuperar perdas com a assinatura, interrompa a venda e não recomende nova despesa. Suporte não deve virar oferta comercial. A decisão de contratar continua sendo da pessoa.';
