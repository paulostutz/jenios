# R101 — correções verificáveis para preparação de lançamento

Data: 28/10/2026. Continuação da PR #22, base R100 `50dfdc01531b3103154736552f1af941456b5c95`.

## Binance

O leitor B166 reutilizava a amostra de serverTime em requisições sequenciais com recvWindow de 5 segundos. Uma resposta de conta de 6 segundos fazia a consulta posterior de ordens expirar. O leitor agora avança o timestamp por tempo monotônico a cada assinatura, inclusive quando o chamador fixa `now` para identificar o snapshot. A janela continua 5 segundos; amostras lentas, relógio regressivo/inválido e âncora com mais de 30 segundos são recusados. Sem repetição automática, hosts novos ou envio de ordens.

## Inicialização do worker

O serviço Render `srv-dbgg33mk1f9s73e78kdg` existe desde 27/10/2026, possui disco de 1 GB e está ligado à branch de trabalho. Os logs de 28/10 mostraram recusas repetidas de boot apesar do deploy constar como live. Isso atualiza a informação histórica do documento R100. O processo agora informa somente um código fixo e permitido para distinguir falhas de flags, volume e permissões; mensagens desconhecidas, caminhos, variáveis e segredos nunca são registrados. Nenhuma barreira foi removida.

## Estado de liberação

As correções não certificam dinheiro real. O núcleo R74 é sintético, o worker R100 é inerte, as contas de corretora e as autorizações Paper estavam vazias na auditoria. Homologação externa, executor Live, credenciais do titular, limites aprovados e prova de recuperação continuam sendo gates obrigatórios. Não representar testes simulados como ordens externas.

## Verificação

Testes cobrem assinatura após latência, assinatura HMAC, relógios inválidos/obsoletos, amostra lenta, diagnóstico sem vazamento, isolamento Testnet/Live e encerramento do worker. CI completa e implantação devem ser conferidas no SHA final. Manter as flags financeiras fechadas em toda validação de infraestrutura.
