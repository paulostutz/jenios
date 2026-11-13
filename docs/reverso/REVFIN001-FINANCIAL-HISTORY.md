# REVFIN001 — histórico mensal e consistência da leitura

Estado: implementação candidata, com fontes sintéticas e testes locais. Este contrato de leitura não ativa execução, checkout, emissão, débito ou recebimento e não aprova publicação.

## Competências independentes

O leitor mantém suporte ao DTO original `JENIOS_REVERSO_FINANCIAL_STATE_V1` e aceita o envelope `JENIOS_REVERSO_FINANCIAL_HISTORY_V1`. O envelope fixa plataforma `jenios`, robô `reverso`, cliente, escopo do titular, ambiente `demo`, modo `offline_fixture` e `syntheticOnly:true`. Cada elemento de `periods` é um DTO financeiro original, validado separadamente contra o mesmo titular e robô.

O máximo é de 120 competências/escopos. A apresentação conserva todas as apurações, ordenadas da competência mais recente para a mais antiga. Moedas, ganhos, perdas, custos e participação não são somados entre competências. Períodos com a mesma competência e o mesmo conjunto de contas, corretora, ambiente e moeda são rejeitados, assim como identificadores de período repetidos. Contas e moedas distintas conservam seu próprio escopo.

Todas as operações de todas as competências são verificadas antes de qualquer corte. A resposta pública mostra até 200 operações, da competência mais recente para a mais antiga e, dentro dela, do encerramento ou abertura mais recente. `hasMore:true` sinaliza um recorte incompleto. Um mês sem linhas nesse recorte não é apresentado como mês sem operações. A apuração do período permanece disponível mesmo quando suas operações antigas ficam fora do recorte.

A identidade de uma linha contém robô, corretora, conta, conexão, ambiente, competência e operação. A mesma operação pode aparecer aberta no retrato de um mês e encerrada no seguinte. Uma repetição da mesma identidade dentro da mesma competência é rejeitada, inclusive quando a linha está depois do limite de 200. A chave de apresentação usa esse mesmo escopo para impedir que o navegador associe linhas de meses ou conexões diferentes.

## Execuções conflitantes

Uma operação marcada pelo redutor como `classification:conflict` não fornece o resultado monetário de uma das variantes. O adaptador a apresenta com estado `unknown`, encerramento nulo, bruto, taxas, financiamento e líquido nulos e custos incompletos. A apuração mantém as pendências recebidas do motor. O adaptador não resolve o conflito nem escolhe qual execução deveria prevalecer.

## Obrigação original e proposta

Quando a fonte fornece `obligations.persistedObligationId`, o período público usa esse valor em `id` e `obligationId`. Se a obrigação ainda não foi persistida, `id` continua sendo o identificador da proposta e `obligationId` fica nulo. O conteúdo original de `proposedIntent` não é renomeado ou alterado. A presença de um identificador persistido não representa pagamento confirmado.

## Retrato financeiro consistente

A composição pode fornecer o callback de servidor `readFinancialSnapshot`. Ele é exclusivo: não pode ser combinado com `readFinancialState` ou `readObligations`. O retorno é `JENIOS_REVERSO_PERSISTED_SNAPSHOT_V1`, com robô, titular, cliente, escopo, revisão SHA-256 em hexadecimal, histórico financeiro e obrigações provenientes da mesma leitura persistida.

O leitor verifica identidade e formato da revisão, compõe apurações e obrigações daquele único retorno, consulta os vínculos originais necessários à prova de pagamento e repete a leitura do retrato financeiro. Ambas as leituras têm prazo limitado. Se a revisão mudar, a releitura falhar ou sua identidade for inválida, os blocos `operations`, `performance`, `obligations` e `policy` ficam indisponíveis com motivo de atualização concorrente. Dados válidos de acesso, carteira existente e ciclos são preservados. O titular continua sendo revalidado ao final.

Essa verificação impede combinar a apuração pronta de uma revisão anterior com uma obrigação que passou a conflito durante a consulta. Uma fonte que não esteja configurada continua indisponível. A origem persistida e seus controles de concorrência pertencem à composição do runtime; o WEB não abre o banco nem cria um repositório financeiro paralelo.

## Evidência e limites

`tests/reverso-history.test.mjs` cobre a fonte original, múltiplas competências e moedas, abertura em um mês e encerramento no seguinte, duplicatas e escopos cruzados, limite de 120 períodos, validação da cauda não exibida, paginação, execução conflitante, identificador persistido e corrida de revisões. As provas de snapshot incluem falha e timeout de ambas as leituras, identidade/revisão inválida e preservação de acesso/carteira/ciclos.

Os testes de interface cobrem chaves distintas por mês/conexão, filtragem por competência e o aviso de recorte incompleto. A evidência HTML SSR foi gerada localmente com dados fictícios; inspeção visual em navegador e screenshots permanecem pendentes no ambiente atual. O build completo e a validação de fonte exata devem ser executados depois do congelamento conciliado. Nenhum desses testes equivale a publicação ou cobrança autorizada.
