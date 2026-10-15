// Public projection: explicit allowlist. Technical findings remain in paid delivery.
export function publicBankscoreSummary(report) {
 const i = report.instituicao;
 return {instituicao: {codigo:i.codigo,nome:i.nome,periodo:i.periodo,tipo:i.tipo,
 percentual:i.percentual,revisao:i.revisao}, fonte:report.fonte, homologacao:report.homologacao,
 escopo:'Consulta gratuita do Índice de Basileia',
 chamada:'Quer saber mais detalhes sobre essa instituição financeira? Faça uma consulta completa agora!'};
}
