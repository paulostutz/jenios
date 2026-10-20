# B141–B146 — Universidade e Gênio/Gênia Pro

## Finalidade e escopo

Este documento registra a implementação e os critérios de retomada dos blocos B141 a B146, desenvolvidos sobre o B140. É uma referência técnica do repositório; não atesta o deployment atualmente publicado, a instalação de schemas em produção, o resultado de uma execução específica de CI ou a ativação de serviços pagos. Esses estados devem ser verificados na próxima retomada.

O trabalho amplia a Universidade e o Pro existentes. O atendimento gratuito de Gênio e Gênia na Social, inclusive para visitantes, continua independente de carteira, assinatura, chave de IA e compra de créditos. Os caminhos originais de Social, BankScore, Validador, JENIOS PAY, TradingView e robôs devem permanecer preservados. Letter e Chefe estão fora do escopo.

As consultas são informativas. O Pro não possui ferramenta para enviar ordens, acessar corretoras, operar a carteira do usuário ou executar negociações. A elegibilidade comercial e o consentimento para uma resposta não autorizam operações de mercado.

## Mapa dos blocos

| Bloco | Mudança | Referências principais |
| --- | --- | --- |
| B141 | Conclusão da jornada da Universidade; persistência e recuperação de avaliações; revisões contínuas; acesso avulso validado novamente contra pedido e comprovante; preservação do progresso na renovação. | [engine.mjs](../../lib/learning/engine.mjs), [service.mjs](../../lib/learning/service.mjs), [university-pass.mjs](../../lib/assistant/university-pass.mjs), [pro-access.mjs](../../lib/assistant/pro-access.mjs) |
| B142 | Contabilidade em nanoUSD, cálculo exato de consumo a 2×, validação de inteiros e separação entre propostas antigas e parâmetros comerciais aprovados. | [pro-pricing.mjs](../../lib/assistant/pro-pricing.mjs), [pro-wallet-contract.mjs](../../lib/assistant/pro-wallet-contract.mjs) |
| B143 | Schema privado com reservas individuais e globais, franquias por ciclo, despacho único, liquidação, conciliação, cotação de recarga, vínculo com pedido e crédito por comprovante. | [pro-wallet-b143.sql](../../db/schema/pro-wallet-b143.sql) |
| B144 | APIs privadas do Pro; cotação assinada; validação de texto e imagens; fonte de candles verificada; despacho controlado ao provedor; recuperação de estados incertos. | [pro-service.mjs](../../lib/assistant/pro-service.mjs), [pro-input.mjs](../../lib/assistant/pro-input.mjs), [pro-provider.mjs](../../lib/assistant/pro-provider.mjs), [pro-repository.mjs](../../lib/assistant/pro-repository.mjs) |
| B145 | Interface Pro completa com personagens, tarefas, saldo comprado, franquia, prévia local da imagem, confirmação por consulta e histórico privado. | [page.js](../../app/genios-pro/page.js), [pro-client.mjs](../../app/genios-pro/pro-client.mjs), [pro.module.css](../../app/genios-pro/pro.module.css) |
| B146 | Cotação e contratação de créditos pelo fluxo privado; Pix existente; confirmação por comprovante; interface de compra e recuperação do mesmo pedido. | [pro-topups.mjs](../../lib/assistant/pro-topups.mjs), [ProCredits.js](../../app/genios-pro/ProCredits.js), [credits-client.mjs](../../app/genios-pro/credits-client.mjs), [catalog.mjs](../../lib/pay/catalog.mjs) |

## Acessos comerciais e Universidade

| Acesso | Universidade | Consumo Pro |
| --- | --- | --- |
| Visitante da Social | Entrada na Universidade depende de conta e elegibilidade. | Atendimento gratuito disponível; Pro privado exige conta. |
| Sem assinatura | Contratação avulsa. | Créditos comprados, após habilitação comercial. |
| `platform-nacional` — R$ 99,90/mês | Contratação avulsa. | Créditos comprados. |
| `platform-global-crypto` — R$ 149,90/mês | Incluída na assinatura vigente. | Franquia limitada a definir, além da origem de saldo comprado quando existente. |
| `platform-internacional-pro` — R$ 199,90/mês | Incluída na assinatura vigente. | Franquia limitada a definir, além da origem de saldo comprado quando existente. |

A classificação considera produtos conhecidos e assinaturas `active` ou `trialing`, com início e fim válidos. Empates são resolvidos de maneira determinística, preservando o mesmo ciclo nas verificações de acesso e reserva. A franquia é vinculada ao usuário, à assinatura e ao início de seu período; não é um saldo ilimitado nem uma concessão mensal criada no navegador. O acesso administrativo permite revisão da Universidade, mas não elimina os controles financeiros do Pro.

O produto avulso é `social-university-pass`, categoria `other`, cobrança `one_time`, moeda `BRL` e duração de **30 dias**. O catálogo padrão o mantém com `active:false` e `price_cents:0`. Zero representa preço ainda não definido; não autoriza checkout gratuito. O cadastro aditivo B146 insere esse produto e `social-ai-pro-credits` inativos, sem sobrescrever cadastros existentes e sem criar planos ou assinaturas.

O acesso avulso exige pedido do próprio usuário, produto correto, moeda e valor válidos, estado `paid`, comprovante `confirmed`, identificação do pagamento e valor coincidente. A janela começa na primeira confirmação válida e dura 30 dias. Repetir o comprovante ou a concessão não reinicia a janela. A consulta de acesso verifica novamente a evidência; um entitlement revogado não é reativado por replay, e um pedido estornado não valida acesso.

A jornada existente contempla cinco trilhas e quinze aulas, nivelamento, avaliações, histórico de resultados e revisões. Gravações usam revisão do estado: mudanças simultâneas são rejeitadas com conflito, e a repetição de uma avaliação já concluída só recupera o resultado quando suas respostas correspondem à tentativa original. A perda ou renovação da elegibilidade não apaga o progresso privado.

A rota `/api/platform/learning` força `OPENAI_API_KEY:''` e `JENIOS_TUTOR_MODEL:''` ao chamar o serviço. O estudo guiado utiliza o material revisado, sem fazer inferência paga por essa rota. O link para o tutor avançado abre `/genios-pro?task=university_tutor`; ele apenas seleciona uma tarefa permitida. A consulta avançada exige uma pergunta explícita do usuário e nova confirmação de consumo. Não são enviados automaticamente o contexto da aula, as respostas das avaliações ou o histórico completo de estudos.

Fontes: [access.mjs](../../lib/learning/access.mjs), [rota de aprendizagem](../../app/api/platform/learning/route.js), [LearningRoom.js](../../app/components/learning/LearningRoom.js), [testes B141](../../tests/jeniosUniversityCompletionB141.test.mjs).

## Precisão financeira e origens de saldo

**1 nanoUSD = 10⁻⁹ USD.** O ledger B143 guarda valores inteiros nessa unidade. Um dólar corresponde a `1_000_000_000` nanoUSD e um microUSD corresponde a `1_000` nanoUSD.

| Grandeza | Representação |
| --- | --- |
| Custo efetivo do provedor | Inteiro `providerCostNanoUsd` / `provider_nano_usd`. |
| Consumo do cliente | Inteiro `retailDebitNanoUsd` / `charged_nano_usd`, exatamente `2 × custo do provedor`. |
| Saldo comprado disponível | `balance_nano_usd - reserved_nano_usd`. |
| Franquia disponível | `allowance_nano_usd - spent_nano_usd - reserved_nano_usd`, dentro do ciclo válido. |
| Orçamento global | Custo do provedor gasto e reservado, por mês UTC, compartilhado entre as duas origens. |
| Pagamento Pix | Centavos inteiros de BRL. |
| Câmbio da recarga | BRL por USD multiplicado por `1_000_000`, preservando seis casas decimais. |

A reserva usa um limite superior de custo; a liquidação usa o consumo efetivamente informado pelo provedor. A diferença da reserva é liberada. Tokens normais, leitura de cache, gravação de cache e saída são contabilizados sem duplicar os subconjuntos de entrada. Uma tarifa que não possa ser representada exatamente na precisão suportada é rejeitada. Não se arredonda cada consulta para um centavo, nem se cobra um mínimo por resposta para compensar frações.

Exemplo apenas aritmético: custo confirmado de `100` nanoUSD implica débito de `200` nanoUSD, apresentado como US$ 0,0000002. Isso não define preço de pacote, franquia ou autorização de gasto.

Os campos antigos em microUSD são compatibilidade de apresentação e podem ser fracionários; não devem ser persistidos como inteiros no ledger B143. `PRO_PACKS`, `PRO_MIN_TOPUP_CLIENT_MICRO_USD` e `PRO_MONTHLY_INCLUDED_MICRO_USD` conservam propostas anteriores. **Essas constantes não aprovam pacotes nem definem as franquias efetivas do novo runtime.** As franquias efetivas vêm da configuração B143.

`PRO_PRICING_VERSION` identifica o snapshot de tarifa implementado (`2026-10-20-v2-nano`). Os nomes de modelos e as tarifas no código exigem verificação e aprovação antes de qualquer ativação. A existência desse snapshot não comprova disponibilidade comercial ou credenciais do provedor. O adaptador B144 envia `tools:[]`, `tool_choice:'none'`, `store:false` e `service_tier:'default'`; não habilita ferramentas faturáveis apenas porque há uma tabela de custos para elas.

Fontes: [pro-pricing.mjs](../../lib/assistant/pro-pricing.mjs), [pro-wallet-contract.mjs](../../lib/assistant/pro-wallet-contract.mjs), [testes B142](../../tests/jeniosProPrecisionB142.test.mjs).

## Travas de ativação e padrões desativados

### Variáveis de ambiente do servidor

| Nome exato | Condição para uso | Comportamento sem configuração |
| --- | --- | --- |
| `JENIOS_PRO_GENERATION_ENABLED` | Deve ser exatamente a string `'true'`, junto com todas as condições do banco e do provedor. | Geração Pro bloqueada. |
| `JENIOS_PRO_PAYMENTS_ENABLED` | Deve ser exatamente `'true'`, junto com configuração comercial, orçamento, tarifa e Pix válidos. | Cotação, checkout e status de recarga bloqueados; nenhuma consulta ao banco de dados, BCB ou banco de pagamento é iniciada pelo serviço de recarga. |
| `OPENAI_API_KEY` | Chave do provedor, somente no servidor; o runtime exige uma string com mais de 20 caracteres. | Geração bloqueada. A checagem de formato não comprova que a chave é válida ou autorizada. |
| `JENIOS_PRO_QUOTE_SECRET` | Segredo do servidor com pelo menos 32 bytes, usado na assinatura HMAC da cotação de consumo. | Cotação/geração Pro bloqueadas. |

Não há variante `NEXT_PUBLIC_` para os segredos e flags de autorização do Pro. Nenhum valor de credencial deve ser incluído no código, neste documento, em logs ou em evidências de teste.

O pagamento reutiliza o transporte Pix existente. A verificação desse transporte exige `JENIOS_PAY_PROVIDER='inter_pix'` e a presença de `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `INTER_CERTIFICATE`, `INTER_PRIVATE_KEY` e `INTER_PIX_KEY`; `INTER_ACCOUNT_NUMBER` é um parâmetro opcional existente. A disponibilidade do JENIOS PAY, por si só, não ativa vendas de créditos Pro. Não alterar a integração original para contornar as travas específicas do Pro.

As variáveis do fluxo generativo anterior, como `JENIOS_GENERATIVE_ENABLED`, `JENIOS_GENERATIVE_MODEL` e `JENIOS_AI_MONTHLY_BUDGET_USD`, não substituem as condições do Pro B143/B144. A rota gratuita da Universidade permanece com a chave removida de seu ambiente de execução.

### Configuração privada `jenios_pro_config_b143`

| Campo | Padrão criado pelo schema | Uso |
| --- | --- | --- |
| `generation_enabled` | `false` | Autorização de geração no banco. |
| `payments_enabled` | `false` | Autorização de vendas no banco. |
| `requires_reconciliation` | `false` | Alarme financeiro; quando verdadeiro impede geração e vendas. Não deve ser limpo para ignorar uma pendência. |
| `pricing_version` | `NULL` | Deve coincidir com a versão suportada pelo runtime. |
| `pricing_approved` | `false` | Aprovação explícita da tarifa. |
| `rates_verified_at` | `NULL` | Verificação de tarifa válida, sem data futura e com no máximo 30 dias. |
| `allowed_models` | Array vazio | Lista explícita de modelos aprovados. |
| `monthly_provider_limit_nano_usd` | `0` | Teto global mensal de custo do provedor. Zero bloqueia o serviço. |
| `max_request_provider_nano_usd` | `0` | Teto de custo do provedor por consulta. O teto correspondente do cliente é duas vezes esse valor. |
| `crypto_allowance_nano_usd` | `0` | Franquia de consumo do plano de R$ 149,90; deve ser aprovada separadamente. |
| `global_allowance_nano_usd` | `0` | Franquia de consumo do plano de R$ 199,90; deve ser aprovada separadamente. |
| `topup_currency` | `NULL` | Moeda-base aprovada para o pacote: `BRL` ou `USD`. |
| `topup_amount_minor` | `NULL` | Valor aprovado em centavos da moeda-base. |
| `commercial_terms_version` | `NULL` | Identificação das condições comerciais aprovadas. |

Esses são os padrões do código de instalação, não uma leitura do banco de produção. Nenhum teto financeiro real, franquia ou valor de pacote é definido por este documento. Os limites máximos aceitos pelos tipos e constraints SQL são limites técnicos, não orçamento autorizado.

Geração e vendas têm flags independentes. Ambas exigem tarifa aprovada e ausência de conciliação pendente; a geração também exige teto por consulta, chave e assinatura de cotação. A venda exige pacote configurado, teto global positivo, Pix configurado e SKU real ativo com categoria `other`, moeda `BRL` e cobrança `one_time`. O catálogo padrão mantém `social-ai-pro-credits` inativo e sem preço. O checkout genérico do PAY recusa esse SKU, e sua edição genérica não permite ativá-lo.

Fontes: [pro-wallet-b143.sql](../../db/schema/pro-wallet-b143.sql), [pro-wallet-contract.mjs](../../lib/assistant/pro-wallet-contract.mjs), [pro-service.mjs](../../lib/assistant/pro-service.mjs), [pro-topups.mjs](../../lib/assistant/pro-topups.mjs), [inter-pix.mjs](../../lib/pay/inter-pix.mjs).

## APIs privadas e execução de uma consulta

| Método e rota | Responsabilidade |
| --- | --- |
| `GET /api/assistant/pro/access` | Verifica conta, plano, acesso educacional, saldo, franquia, pendências, tarefas, símbolos e oferta de créditos. Não concede saldo. |
| `GET /api/assistant/pro/history` | Retorna até 50 consultas da própria conta, com estados, valores e resposta/fonte quando disponíveis. |
| `POST /api/assistant/pro/quote` | Prepara cotação de consumo assinada, válida por cinco minutos. Não reserva saldo, não cobra e não gera resposta. |
| `POST /api/assistant/pro/chat` | Valida a cotação e o consentimento, reserva os limites, adquire o despacho, executa a consulta e liquida ou mantém a pendência. |
| `POST /api/assistant/pro/credits/quote` | Cria ou recupera uma cotação comercial imutável. Não abre cobrança bancária. |
| `POST /api/assistant/pro/credits/checkout` | Confirma os valores da cotação e prepara um único pedido de pagamento. Não confirma crédito na carteira. |
| `GET /api/assistant/pro/credits/status?orderId=…` | Confere o mesmo pedido e o comprovante; somente então tenta registrar o crédito idempotente. Essa rota pode reconciliar pagamento e conceder crédito, portanto não é uma simples leitura sem efeitos. |

As rotas Pro exigem a identidade verificada pelo backend e recusam usuários anônimos. A recarga desativada retorna seu bloqueio antes mesmo de autenticar ou acessar dependências. O cliente não escolhe usuário, modelo, tarifa, custo efetivo ou câmbio. As respostas privadas usam `Cache-Control: private, no-store`, `Vary: Authorization` e `X-Content-Type-Options: nosniff`.

O corpo da consulta contém `persona`, `task`, `prompt`, `source` e, quando aplicável, `symbol`, `timeframe` e `image`. A origem é `prepaid` ou `included`; não há mistura automática de saldos para completar uma consulta. O envio confirmado acrescenta `requestKey` UUID, `quoteId`, `consent:true` e o `maxRetailNanoUsd` exato da cotação. A assinatura vincula usuário, impressão digital da consulta, origem, modelo, tarifa, teto e prazo.

O texto tem limite de 2.500 caracteres. Imagens são enviadas como `{mime,base64}`, de forma efêmera, com PNG/JPEG/WebP, até **3 MB exatos (3.000.000 bytes)** e dimensões entre 64 e 4.096 pixels em cada eixo. O limite considera o crescimento do arquivo ao ser representado em base64 no corpo JSON. O servidor verifica assinatura do formato, bytes e dimensões. Não há URL externa de imagem, upload em storage ou reaproveitamento de identificador de mídia no contrato B144.

As tarefas que exigem dados atuais usam somente os ativos e intervalos devolvidos por `access`: inicialmente `BTC-USD`, `ETH-USD`, `SOL-USD`, nos períodos `1m`, `5m` e `1h`. O adaptador reutiliza a fonte Coinbase Exchange e exige o último candle completo esperado. A consulta é rejeitada antes da reserva quando a fonte falha ou está defasada. A resposta identifica ativo, período e fechamento da fonte; não apresenta a série como stream em tempo real. Uma foto não é tratada como cotação atual nem autoriza inventar números ilegíveis.

Fontes: [pro-input.mjs](../../lib/assistant/pro-input.mjs), [pro-provider.mjs](../../lib/assistant/pro-provider.mjs), [pro-service.mjs](../../lib/assistant/pro-service.mjs).

## Reservas, perda de resposta e conciliação

O fluxo normal é: validar a conta e a cotação; obter a fonte necessária; reservar simultaneamente limite individual e global; adquirir o despacho uma única vez; conferir o limite exato de tokens; chamar o provedor; liquidar o uso confirmado. As reservas e alterações financeiras são executadas por RPCs com bloqueios de linha e identificadores únicos.

| Estado persistente | Significado e tratamento |
| --- | --- |
| `reserved` | Limites retidos, sem despacho adquirido. A reserva tem prazo de cinco minutos. Uma recusa antes do envio pode liberá-la com motivo registrado. |
| `dispatched` | Um processo adquiriu o envio. Outro processo não pode executar novamente a mesma consulta. |
| `settled` | Uso confirmado e débito exato a 2× registrado; repetição devolve o resultado existente. |
| `released` | Reserva liberada de forma confirmada. O extrato não a apresenta como consumo cobrado. |
| `needs_reconciliation` | Resultado ou consumo inconclusivo, ou custo acima da reserva. A reserva permanece retida e o serviço entra em pausa para conferência. |

`not_started` é um estado de resposta da API para rejeições anteriores à operação; não é um estado persistente do ledger.

O adaptador confere os tokens antes da inferência. Quando essa etapa termina sem iniciar a geração, o servidor pode registrar `confirmed_no_charge` com custo zero explícito e liberar a reserva. Após uma tentativa de inferência, timeout, erro HTTP, envelope inválido, tarifa não reconhecida ou uso sem confirmação não são presumidos como custo zero. Não há retry automático do modelo.

Se a resposta do banco de dados for perdida, o serviço relê o estado durável. Uma consulta já liquidada é recuperada; uma reserva ainda não despachada pode ser liberada; um despacho incerto é marcado para conciliação. O cliente mantém a solicitação pendente, bloqueia novo envio e orienta a conferir o histórico. Uma resposta perdida não autoriza trocar a chave para tentar cobrar ou gerar novamente.

`mark_unknown` e o estouro de reserva desativam `generation_enabled` e `payments_enabled` e marcam `requires_reconciliation=true`. A conciliação `confirmed_no_charge` ou `confirmed_cost` exige evidência verificada com referência, responsável e motivo. Não há endpoint público para o cliente produzir essa evidência. Custo já conhecido não pode ser apagado sob a alegação de ausência de cobrança, e o cliente não pode ser debitado acima do teto confirmado.

Resolver a última pendência pode limpar o alarme, mas **não reativa geração ou vendas**. A causa precisa ser revisada e a reativação precisa de autorização explícita. Um trigger impede reativar enquanto houver conciliação pendente. O mero transcurso do tempo não libera uma consulta despachada.

Fontes: [RPCs B143](../../db/schema/pro-wallet-b143.sql), [pro-service.mjs](../../lib/assistant/pro-service.mjs), [testes do ciclo B144](../../tests/jeniosProLifecycleB144.test.mjs).

## Recarga, comprovante e pausa de vendas

A moeda-base e o valor do pacote precisam de aprovação explícita. O cliente nunca envia um preço livre ou uma taxa de câmbio. O servidor consulta a origem fixa do Banco Central, usa PTAX de venda de fechamento com no máximo 72 horas e preserva a cotação por 15 minutos. Se o câmbio não puder ser verificado, nenhum pedido é aberto.

A cobrança liquida em BRL. Para pacote-base em USD, o valor de pagamento é convertido para centavos de BRL com arredondamento para cima; para pacote-base em BRL, o crédito equivalente é calculado em nanoUSD com divisão inteira. A tela mostra os dois valores, o câmbio, a data e as condições antes do aceite. Essa conversão de compra é separada da regra de consumo a exatamente 2× o custo da API.

A cotação comercial fica imutável no banco. O checkout exige `quoteId`, `requestKey`, `acceptTerms:true`, `amountCents`, `currency:'BRL'` e `termsVersion` coincidentes com a cotação. O vínculo entre cotação e pedido é criado atomicamente antes da chamada ao gateway existente. Repetir a mesma solicitação preserva o pedido e o identificador Pix; não cria um pagamento alternativo para resolver um timeout.

Estado `paid` isolado, retorno de checkout ou visita à página de pagamento não concedem créditos. O financiamento da carteira exige o pedido correto, cotação vinculada, dono, produto, moeda, valor e comprovante confirmado do provedor. Há unicidade por pedido, cotação e comprovante. A operação de crédito é idempotente.

Quando o pagamento ou a liberação ainda requer conferência, a API retorna `paid_pending_credit` e `credited:false`; a interface não afirma recebimento concluído, não aumenta saldo de forma otimista e não oferece outra cobrança como solução. Falha de transporte após preparar o pedido usa `order_unconfirmed` ou `order_preserved` e `retrySameOrder:true`. Rejeições definitivas, como cotação vencida antes de criar o pedido, são diferenciadas desse estado incerto.

Com vendas pausadas, o serviço público de recarga bloqueia também a consulta de status: não se deve prometer acompanhamento bancário disponível por essa rota durante a pausa. A interface guarda a referência do mesmo pedido para retomada. Recuperar cobranças pendentes nessa situação exige avaliação operacional autorizada; não se deve alterar o gate, chamar o transporte genérico ou conceder saldo manualmente para contornar o bloqueio. A rotina SQL de confirmação mantém suas próprias exigências de comprovante, inclusive para recuperação privilegiada de um pedido já pago.

Fontes: [pro-topups.mjs](../../lib/assistant/pro-topups.mjs), [pro-wallet-b143.sql](../../db/schema/pro-wallet-b143.sql), [testes B146](../../tests/jeniosProTopupsB146.test.mjs).

## Interface, extrato e isolamento

A tela `/genios-pro` mantém os dois personagens, links para a Social gratuita e Universidade, seleção de tarefa e confirmação por resposta. Parâmetros de URL só podem selecionar uma tarefa da lista permitida; não preenchem a pergunta, não transportam uma aula e não dão consentimento. Campos ausentes, saldos inválidos, franquia não configurada ou histórico indisponível não viram saldo zero presumido nem permissão para consumir.

O extrato privado separa créditos comprados de franquia, mostra reservas e consumo e permite recuperar respostas concluídas com a identificação da fonte. Estados pendentes exibem valor a confirmar. A resposta é renderizada como texto, sem HTML. O endpoint fornece até 50 consultas; não representa um extrato administrativo completo de todas as contas ou de todos os pagamentos.

Troca de conta e saída de sessão abortam requisições e limpam pergunta, imagem, resposta, cotação e consentimento da interface Pro. Cada chamada obtém novamente a sessão e verifica a identidade esperada. O componente de recarga é remontado por usuário. Somente a referência de recuperação — cotação, chave e pedido — é guardada em `sessionStorage`, sob chave própria da conta; não são guardados token, Pix, imagem ou pergunta nesse registro. Dados restaurados não substituem autenticação ou verificação no servidor.

A imagem é mantida apenas durante o preparo da consulta e enviada ao provedor após consentimento. Não é armazenada no extrato. O resultado persistido pode conter a resposta, o personagem e a fonte; o histórico não devolve o texto original da pergunta nem a imagem. Isso não deve ser interpretado como garantia de que uma resposta do modelo nunca possa repetir algo informado pelo usuário.

No banco, todas as tabelas B143 têm RLS e privilégios revogados de `PUBLIC`, `anon` e `authenticated`, sem política pública que permita acesso direto. As funções usam `SECURITY INVOKER`, `search_path` explícito e execução restrita a `service_role`. Os endpoints filtram pelo usuário verificado. Cotação comercial e registro de crédito têm proteção contra alteração/exclusão; o navegador não escreve no ledger nem recebe parâmetros internos do orçamento global.

A interface de pagamento aceita apenas a rota relativa `/social/pagamento?pedido=<UUID do pedido conferido>` e não redireciona automaticamente. O Pix deixa de ser oferecido quando o serviço estiver bloqueado. Não há geração, pagamento ou crédito simulado para preencher a tela.

Fontes: [page.js](../../app/genios-pro/page.js), [ProCredits.js](../../app/genios-pro/ProCredits.js), [pro-repository.mjs](../../lib/assistant/pro-repository.mjs), [schema B143](../../db/schema/pro-wallet-b143.sql).

## SQL, instalação e validação

| Arquivo | Papel e restrição |
| --- | --- |
| `db/schema/pro-wallet-b143.sql` | Schema financeiro usado pelo runtime novo. Não é migração automática. O executor autorizado controla a transação. Cria a configuração com geração e pagamentos desligados; não vende pacotes nem concede créditos. |
| `db/schema/university-pro-catalog-b146.sql` | Insere somente os dois SKUs de Universidade avulsa e créditos Pro, ambos inativos e com preço zero não aprovado. `ON CONFLICT (code) DO NOTHING` preserva integralmente produtos existentes. Não cria planos, assinaturas, pedidos ou saldos. |
| `db/schema/university-pro-pay-read-b146.sql` | Concede ao `service_role` somente a leitura das sete colunas de assinatura necessárias à elegibilidade e vigência. Não concede escrita, não altera RLS e não concede privilégios a visitantes ou usuários autenticados. |
| `scripts/platform/b143-wallet-fixture.sql` | Dependências artificiais para PostgreSQL local descartável, exclusivamente no banco `jenios_pro_b143_test`. **Nunca executar no Supabase ou em banco com dados reais.** |
| `scripts/platform/b143-wallet-sql-test.sql` | Testes de aritmética, permissões, planos, reservas, conciliação e financiamento com dados de fixture. |
| `scripts/platform/b143-wallet-concurrency.mjs` | Sessões SQL simultâneas para reservas duplicadas, despacho único e concorrência pelo orçamento global, no mesmo banco descartável. |
| `scripts/platform/b146-catalog-sql-test.sql` | Testa o cadastro inativo, UUIDs gerados e reexecução sem sobrescrever registros, exclusivamente na fixture descartável. O próprio teste inclui o cadastro e reverte os registros fictícios. |
| `scripts/platform/b146-pay-read-sql-test.sql` | Reproduz ausência de leitura da assinatura na fixture, verifica o acesso mínimo do servidor e preserva ausência de escrita e de concessões a outros papéis. Reverte as alterações ao terminar. |
| `supabase/migrations/20261020031500_university_addon_b140_REVIEW_ONLY.sql` | Cadastro inativo do passe de 30 dias, sem preço aprovado. Validar separadamente a necessidade de aplicação. |
| `supabase/migrations/20261020025500_jenios_pro_credits_b138_REVIEW_ONLY.sql` | Estrutura anterior em microUSD, preservada como referência. O runtime B143 usa tabelas/RPCs com sufixo `_b143`; aplicar o B138 não instala o novo contrato. |

Antes de qualquer instalação real, verificar de forma autorizada as dependências `auth.users` e as tabelas PAY existentes, os objetos já instalados, permissões e referências. A verificação de plano exige leitura de `id`, `user_id`, `product_id`, `status`, `current_period_start`, `current_period_end` e `created_at` em `jenios_pay_subscriptions`; sem essa permissão, a aplicação recusa a conferência de elegibilidade, mesmo quando não há assinaturas cadastradas. Criar backup individual do bloco e preparar a transação revisada. Não executar fixtures, não semear créditos e não substituir tabelas originais do PAY. Eventual migração de valores do contrato antigo exige conversão explícita de microUSD para nanoUSD, reconciliação e autorização; não há migração automática de saldos neste bloco.

Instalar a estrutura não equivale a ativar geração, venda ou preço. A existência e a configuração dos produtos no banco devem ser verificadas separadamente. Os defaults do catálogo em JavaScript não comprovam que um SKU já está cadastrado no banco.

### Sequência da CI

O workflow de referência é [jenios-s05-platform-cp70-integration.yml](../../.github/workflows/jenios-s05-platform-cp70-integration.yml). Ele possui dois jobs independentes; ambos precisam estar aprovados para considerar a versão candidata à publicação.

**`verify-pro-postgres`:** sobe PostgreSQL 17 descartável, aplica fixture e schema B143, testa o cadastro e a leitura mínima B146 dentro de transações revertidas, executa os testes financeiros SQL e, por fim, as sessões concorrentes. A reprodução abaixo só é válida com conexão previamente conferida para o banco local descartável:

```sh
psql -X -v ON_ERROR_STOP=1 -f scripts/platform/b143-wallet-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f db/schema/pro-wallet-b143.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/platform/b146-catalog-sql-test.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/platform/b146-pay-read-sql-test.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/platform/b143-wallet-sql-test.sql
node scripts/platform/b143-wallet-concurrency.mjs
```

**`verify-integrated-release`:** usa Node 22; verifica os caminhos preservados e a identidade visual; instala o lockfile com `npm ci --ignore-scripts --no-audit --no-fund`; executa `npm test`, `npm run test:release-s05` e `npm run build`; inicia o servidor local na porta 3127; executa `cp69-browser-smoke.mjs` e `b145-pro-ui-smoke.mjs`; gera manifesto de integridade e pacote das fontes. O script de build já inclui suas próprias regressões e a checagem de escopo de ambiente.

O smoke B145 verifica visitantes, navegação gratuita, personagens, arquivos locais, bloqueios financeiros, ausência de vazamento privado e layout em diferentes larguras. Usa Chrome/Chromium local (`CHROME_BIN`, quando necessário) e recusa uma URL-base que não seja HTTP local. As verificações de recarga sem autenticação aceitam apenas bloqueio por configuração ou por identidade, sem devolver pedido, Pix ou crédito.

| Testes novos | Cobertura principal |
| --- | --- |
| `tests/jeniosUniversityCompletionB141.test.mjs` | Jornada existente, persistência, renovação, idempotência, comprovantes e isolamento de alunos. |
| `tests/jeniosProPrecisionB142.test.mjs` | Frações, cache, exatidão de 2×, propostas não autorizadas e defaults fechados. |
| `tests/jeniosProLifecycleB144.test.mjs` | Cotação assinada, gates, despacho único, perdas de resposta, uso incerto, imagem e fonte verificada. |
| `tests/jeniosProInterfaceB145.test.mjs` | Apresentação de valores, elegibilidade de envio, expiração, imagem e pendências. |
| `tests/jeniosProTopupsB146.test.mjs` | Política comercial, cotação, vínculo atômico, replay, transporte Pix com doubles e comprovantes. |
| `tests/jeniosProCreditsInterfaceB146.test.mjs` | Oferta autorizada, moeda/câmbio, valores exatos, URL restrita e recuperação sem crédito otimista. |

Esses testes usam doubles, dados locais e PostgreSQL descartável. Não devem ser apresentados como pagamento bancário real, crédito real em conta ou análise generativa real. O workflow de regressão não instala o schema em produção nem publica uma versão por conta própria. Resultados concretos, hashes, execução oficial e evidências da publicação devem ser registrados fora deste documento, na entrega correspondente, com os backups individuais solicitados.

## Decisões e autorizações ainda necessárias

| Decisão | O que precisa ser confirmado |
| --- | --- |
| Preço da Universidade | Valor em BRL para `social-university-pass`, em centavos, mantendo a duração de 30 dias e a separação dos créditos Pro. |
| Pacote inicial de créditos | Valor, moeda-base (`BRL` ou `USD`) e condições comerciais. Nenhuma proposta antiga está aprovada por constar no código. |
| Franquias dos planos | Valores de consumo em nanoUSD para os planos de R$ 149,90 e R$ 199,90, vinculados ao ciclo. O plano de R$ 99,90 e contas sem assinatura não recebem franquia implícita. |
| Teto global | Custo máximo mensal do provedor, em nanoUSD, considerando consumo gasto e reservado de todas as contas. |
| Teto por consulta | Custo máximo do provedor por consulta e correspondente teto de consumo do cliente, sempre a 2×. |
| Modelo e tarifa | Disponibilidade real dos modelos, versão de tarifa, revisão da tabela, `allowed_models`, `pricing_approved` e `rates_verified_at`. |
| Credenciais de IA e assinatura | Configuração autorizada de `OPENAI_API_KEY` e `JENIOS_PRO_QUOTE_SECRET`, somente no servidor. Não registrar seus valores em evidências. |
| Instalação e catálogo | Conferência do banco de destino, aplicação revisada do schema, existência dos SKUs, preços e estados inativos antes da ativação. |
| Ativação de geração e vendas | Autorizações separadas para habilitar as flags e os campos do banco, com orçamento definido e ausência de pendências. Instalação ou aprovação da CI não substitui essas autorizações. |
| Validação financeira real | Se solicitada, definir previamente ambiente, operação concreta, valor, orçamento e autorização. Os testes automatizados deste bloco não a realizaram. |

## Retomada recomendada

1. Conferir a revisão do repositório e os arquivos citados; preservar as funções existentes e tratar este documento como mapa de implementação, sem reconstruir o B140.
2. Auditar a instalação efetiva do schema, a configuração privada, o catálogo e a presença das variáveis necessárias, sem expor seus valores secretos. Verificar pendências de conciliação antes de qualquer proposta de ativação.
3. Confirmar as decisões comerciais e os tetos acima. Manter valores ausentes como não configurados; não aproveitar constantes de proposta para preencher lacunas.
4. Executar a CI completa para a revisão candidata, revisar os artefatos e preservar os backups individuais dos blocos. Corrigir qualquer falha antes da publicação.
5. Realizar somente a instalação/publicação e as ativações que estejam autorizadas. Confirmar o atendimento gratuito, Universidade e Pro bloqueado ou liberado conforme a configuração efetiva, sem usar uma operação financeira real como teste implícito.
