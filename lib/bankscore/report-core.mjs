export function montarLaudo(instituicao) {
  const valido = instituicao?.revisao === 'PROVISORIO' && Number.isFinite(instituicao?.percentual);
  const percentual = instituicao?.percentual;

  let interpretacao;
  if (!valido) {
    interpretacao = 'O indicador não pode ser interpretado com segurança: valor ausente ou sinalizado para revisão.';
  } else if (percentual < 8) {
    interpretacao = 'O percentual provisório é baixo e merece atenção prioritária. Sem confirmar o enquadramento regulatório, não é possível declarar descumprimento de requisito.';
  } else if (percentual < 12) {
    interpretacao = 'O percentual provisório sugere menor folga de capital do que valores mais elevados. A conclusão depende do requisito específico da instituição e de sua evolução.';
  } else {
    interpretacao = 'O percentual provisório sugere uma posição de capital relativamente mais confortável, mas não comprova, isoladamente, solidez financeira ou liquidez.';
  }

  return {
    instituicao,
    interpretacao,
    classificacao: !valido ? 'DADO SOB REVISÃO' : percentual < 8 ? 'ATENÇÃO PRUDENCIAL' : percentual < 12 ? 'ANÁLISE COMPLEMENTAR' : 'SINAL FAVORÁVEL DE CAPITALIZAÇÃO',
    criterio: 'Faixas de leitura exclusivamente explicativas do JENIOS, não são limites regulatórios nem rating de crédito.',
    minimoRegulatorio: null,
    diferencaPontosPercentuais: null,
    conclusao: !valido ? 'Parecer técnico suspenso até validação do dado.' : 'O indicador de capitalização foi interpretado, mas não permite concluir a condição global da instituição sem informações complementares.',
    fundamentos: [
      'O Índice de Basileia relaciona o patrimônio de referência aos ativos ponderados pelo risco.',
      'Os mínimos prudenciais variam conforme segmento, tipo de instituição, adicionais de capital e normas aplicáveis.',
      'Capitalização e liquidez são dimensões distintas. Índice elevado não garante capacidade de honrar saques.',
      'Indicador baixo ou em queda pode sinalizar vulnerabilidade, mas não autoriza prever liquidação sem outros dados.'
    ],
    pendencias: [
      'Confirmar percentual e enquadramento na fonte oficial do BCB',
      'Determinar requisito regulatório aplicável e adicionais de capital',
      'Conferir o fechamento trimestral mais recente e a tendência histórica',
      'Avaliar liquidez, inadimplência, rentabilidade, provisões e qualidade dos ativos'
    ],
    metodologia: 'Leitura prudencial preliminar baseada em um único indicador provisório. Nenhum limite mínimo foi presumido.',
    fonte: 'BCB IFData (base de homologação processada pelo JENIOS)',
    homologacao: true
  };
}
