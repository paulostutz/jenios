/** Canonical disclosure. Numeric publication remains disabled until methodology validation. */
export const JENIOS_INDEX_NAME = 'Índice JENIOS de Indicadores Financeiros';
export const JENIOS_INDEX_NOTICE = 'O Índice JENIOS sintetiza os indicadores financeiros apresentados neste laudo, conforme a metodologia descrita e os dados disponíveis na data-base. Sua finalidade é facilitar a compreensão e complementar a análise. Não representa probabilidade de falência, garantia de solvência ou recomendação de investimento e não deve ser utilizado isoladamente para tomar decisões.';
export function unavailableJeniosIndex({dataComplete=false,period=null}={}) {
  return {
    name:JENIOS_INDEX_NAME,value:null,period,
    status:dataComplete?'METODOLOGIA_NAO_VALIDADA':'DADOS_INSUFICIENTES',
    label:dataComplete?'Metodologia em validação':'Dados insuficientes para calcular o índice',
    reason:dataComplete?'A série contábil disponível ainda não autoriza a publicação de uma nota. Os critérios e pesos precisam ser validados.':'Ainda faltam indicadores financeiros conferidos e comparáveis para compor o índice.',
    notice:JENIOS_INDEX_NOTICE,methodologyVersion:null,
  };
}
