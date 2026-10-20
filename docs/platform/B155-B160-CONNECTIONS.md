# B155–B160 — guias e preparação de conexões individuais

Base de desenvolvimento: B154 0e2952961d150c8b5a808a0345c522c2ef8cb3e1. Produção preservada: B148 4559d2ace3ac0cd4c95db55c67b7a7b671dece31. Escopo exclusivo JENIOS. Não há autorização de dinheiro real neste bloco.

## Entrega e disponibilidade real

B155: catálogo compartilhado com 12 guias: Binance Spot, Profit/Nelogica, Genial, Clear, XP, BTG, MetaTrader 5, cTrader, Interactive Brokers, Alpaca, Mercado Bitcoin e Kraken. Cada guia contém seis etapas, requisitos, campos explicados, erros comuns, revogação e referências oficiais. As quatro corretoras B3 são caminhos via Profit, não quatro APIs proprietárias implementadas. Nenhum cadastro no catálogo significa conta conectada.

B156: o material serve ao Gênio e à Gênia gratuitos e ao contexto de conhecimento existente. Respostas de suporte de integração permanecem determinísticas, sem gasto de IA. A rota gratuita e o formulário bloqueiam padrões de segredos, sem reproduzi-los. Detecção de padrões não garante identificação de toda forma possível de segredo; a interface não solicita credenciais. O Pro mantém seu código financeiro e provider inalterados, com um link para ajuda gratuita.

B157: a antiga tela demonstrativa /integracoes tinha chave fictícia, regeneração aleatória e status de gateway constante. Foi substituída pela central de guias. Os checklists são apenas de leitura, temporários e nunca confirmam conta ou permissão. Sala de Controle e Mesa apontam para guias individuais. Apenas texto e navegação no modal de corretora foram alterados; controles e cálculos operacionais foram preservados. Não há formulário de credenciais ou falso instalador.

B158: utilitário privado de consulta Binance Spot Testnet e Alpaca Paper. Rotas/hosts fixos, GET somente, limite de tempo e corpo, assinatura HMAC Binance, verificação de relógio, redirecionamentos proibidos, sem retry, sem envio de ordens, saques ou transferências. A projeção de saída omite segredos, saldo e identificadores de conta. canWithdraw/canTrade da resposta Binance não são tratados como auditoria de permissões da chave. Não há endpoint HTTP público que importe o leitor. Os testes usam exclusivamente respostas simuladas e credenciais fictícias; não houve teste autenticado externo.

B159: contrato offline para relatos de Profit/MT5/cTrader/IBKR. Verifica formato, conta esperada, ambiente demo/paper, leitura, data e contagens, mas sempre informa connected=false e verifiedByProvider=false. Não contém DLL, Expert Advisor, OAuth ou transporte de terminal. Validar formato não autentica fornecedor.

B160: regressão e verificação visual em localhost; o resultado final é a CI do SHA exato, não uma promessa nesta documentação. A primeira tentativa local de regressão total ficou impedida pela ausência de dependências e falha DNS do registro npm; os testes novos foram executados localmente. O ambiente de CI instala as dependências travadas e executa a regressão completa, build e navegação. Logs de falhas não devem ser omitidos.

## Proteções preservadas

Não foram recebidas credenciais de clientes, concedidos planos, efetuados pagamentos, contratados serviços, enviados comandos a corretoras ou modificados núcleos proprietários. Sem alterações de schema. Social, BankScore, Validador, PAY, TradingView, Universidade e regras financeiras do Pro não são reconstruídos. A escolha persistente de personagem e o Direct do B148 são novamente verificados.

Cada API exige seus requisitos específicos. Licença do conector, autorização da conta e avaliação técnica não equivalem a homologação universal de cada estratégia. Os guias não oferecem contorno de restrições regionais; HTTP 451/403 é motivo de interrupção. Conta real continua bloqueada.

## Próxima conexão verificável

O leitor privado precisa receber credenciais exclusivamente TESTNET/PAPER por ambiente seguro, fora de chat e repositório. Executar `node scripts/platform/connections/read-test-account.mjs binance --read-test-account-only` ou substituir binance por alpaca. Variáveis: JENIOS_BINANCE_TESTNET_API_KEY/JENIOS_BINANCE_TESTNET_SECRET ou JENIOS_ALPACA_PAPER_API_KEY/JENIOS_ALPACA_PAPER_SECRET. Não gravar segredos em arquivo compartilhado, argumento de linha de comando ou evidência.

Mesmo uma consulta bem-sucedida não vincula conta à identidade JENIOS, não certifica permissões e não libera negociação. Armazenamento seguro, vínculo de conta, OAuth/terminal instalado, posições/ordens, limites, proteção e reconciliação precisam ser validados separadamente antes de um piloto externo.

## Fontes

As 21 referências de fornecedor e datas de revisão estão em CONNECTION_SOURCES, em lib/platform/connections/catalog.mjs. Sua função é orientar configuração, não declarar parceria comercial ou recomendação de investimento. Menus, disponibilidade e termos podem mudar; conferir a fonte antes de ativar um acesso.
