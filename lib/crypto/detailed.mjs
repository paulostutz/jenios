export function detailedCryptoReport(report, orderId) {
  if (report.supported === false || report.providerError) throw Object.assign(new Error('A fonte da rede está indisponível. O pedido permanece válido para tentar novamente; nenhum laudo conclusivo foi emitido.'), { status: 503 });
  const findings = [];
  const add = (level, code, title, explanation) => findings.push({ level, code, title, explanation });
  if (!report.found && report.inventory?.available && report.inventory.tokens.length) add('inconclusive','native-account-not-observed','Conta principal sem registro, tokens observados separadamente','A consulta básica não encontrou a conta principal, mas o inventário retornou contas ou contratos com saldo. As duas leituras têm escopos diferentes; não equivalem a titularidade ou liquidez.');
  else if (!report.found) add('attention', 'no-evidence', 'Sem evidência positiva nesta consulta', 'O endereço ou hash não apresentou evidência positiva na fonte consultada. Isso não prova fraude nem impede que um endereço válido receba ativos no futuro.');
  else add('observed', 'observed', 'Registro observado na rede selecionada', 'A fonte respondeu com dados associados ao identificador. Encontrar um registro não comprova quem o controla, a finalidade da operação ou a legitimidade de uma oferta.');
  if (report.type === 'transaction') {
    const failed = report.status === 'falhou on-chain' || (report.evidence?.resultadoExecucao && report.evidence.resultadoExecucao !== 'SUCCESS');
    if (failed) add('attention', 'execution-failed', 'Execução com falha', 'Uma transação registrada pode falhar. A presença do hash não demonstra que o ativo chegou ao destinatário. Confira o recibo e a movimentação no explorador.');
    else if (['confirmada', 'finalized', 'confirmed'].includes(report.status)) add('observed', 'confirmed', 'Confirmação observada', 'A fonte informa confirmação. Não foi calculada uma política de finalidade para cada rede; a confirmação não constitui prova de titularidade ou origem lícita.');
    else add('inconclusive', 'finality-unknown', 'Finalidade não comprovada', 'O estado retornado não permite afirmar liquidação definitiva. Transações pendentes e confirmações não consultadas não devem ser tratadas como saldo disponível.');
    add('inconclusive', 'transfer-scope', 'Valor recebido e ativo transferido', 'Este relatório não decodifica todos os eventos, transferências internas ou contratos envolvidos. Para comprovar o ativo e a quantia recebida, compare o recibo, o contrato correto e o saldo do destinatário no explorador.');
  }
  if (report.type === 'wallet') {
    add(report.inventory?.available ? 'observed' : 'inconclusive', 'wallet-inventory', report.inventory?.available ? 'Inventário de tokens da rede consultada' : 'Inventário de tokens indisponível', report.inventory?.available ? `Foram listados ${report.inventory.tokens.length} contratos ou mints com saldo positivo. ${report.inventory.scope} A identidade é comparada a um catálogo limitado de emissores; ausência no catálogo não significa falso.` : 'A consulta básica da conta não substitui o inventário de tokens. A fonte não permitiu concluir essa enumeração. Não foi calculada uma parcela falsa do saldo.');
    if (report.evidence?.bytecode) add('attention', 'wallet-contract', 'O endereço contém código de contrato', 'Um contrato não equivale automaticamente a uma carteira pessoal. Verifique a finalidade do contrato antes de enviar ativos.');
    add('inconclusive', 'ownership', 'Titularidade não verificada', 'Visualizar o endereço, o saldo, um vídeo ou uma captura de tela não prova controle da carteira. Nunca forneça frase-semente ou chave privada.');
  }
  if (report.type === 'token') {
    const identityLevel = report.authenticity?.status === 'issuer_address_match' ? 'observed' : report.authenticity?.status === 'symbol_address_mismatch' ? 'attention' : 'inconclusive';
    add(identityLevel, 'token-reference', 'Comparação do contrato com referência do emissor', report.authenticity?.label || 'Não há uma referência de emissor confirmada para este contrato.');
    add('inconclusive', 'token-audit', 'Liquidez e segurança do contrato não auditadas', 'Um contrato publicado, um símbolo conhecido ou uma transferência bem-sucedida não provam lastro, resgate, liquidez, ausência de bloqueios ou segurança do código. Não foi executada simulação de compra ou venda.');
    if (report.authenticity?.source) add('observed', 'issuer-source', 'Fonte para comparação independente', report.authenticity.source);
  }
  return { ...report, detail: { version: 'jenios-crypto-detail-v1', orderId, findings, methodology: 'Nova leitura da fonte pública no momento da emissão; interpretação das evidências observadas e comparação com catálogo limitado de emissores quando aplicável. Nenhuma análise é armazenada na nuvem.', limitations: ['Não é recomendação de investimento, certificação de autenticidade ou garantia contra fraude.', 'Não comprova titularidade, origem dos recursos, preço, liquidez ou possibilidade de saque.', 'O estado pode mudar após a emissão; novas tentativas consultam novamente a rede.', 'A confirmação do pagamento não altera o resultado técnico, que pode ser negativo ou inconclusivo.'] } };
}
