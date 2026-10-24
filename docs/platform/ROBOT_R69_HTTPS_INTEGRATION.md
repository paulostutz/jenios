# R69 — integração HTTPS do host privado com as rotas Next existentes

## Objetivo e base

O R69 fecha a lacuna de transporte e de ligação entre o host privado, a rota Next R67, o runtime, o SDK Supabase e o armazenamento R67. Reaproveita o carregador dos módulos originais, as duas assinaturas, a fila durável e o ciclo de vida do host. Não amplia a política automática R65 nem altera estratégias.

Base certificada consultada antes das alterações: `780a786bee6d8fe928dcf356ec16af4c36abd422`, pesquisa R68 e `backup/jenios-robot-r68-private-host-readiness-certified-20261024`, CI `40123178407`, job `120958950536`, SUCCESS em 24/10/2026 às 19:00:55 UTC. O projeto Vercel apresentou zero deployments desse SHA. R68 permanece encerrado; suas evidências conservam os SHAs de origem.

Pesquisa R69: `research/jenios-robot-r69-https-integration-20261024`. Backups: `backup/jenios-robot-r69-https-integration-progress-20261024` e, somente após a CI final, `backup/jenios-robot-r69-https-integration-certified-20261024`.

## Entrega

- `robot-r69-https-transport.mjs`: transporte HTTPS para o protocolo R67 inalterado, com destino declarado e endpoint fixo `/api/platform/robot-private-observations`.
- `robot-r69-private-host.mjs` e a CLI `r69-private-host.mjs`: perfil fixo R69 que reutiliza o laço, a exclusão do host, o carregador, a fila, a parada e a retransmissão R68/R67.
- `r69-next-acceptance.mjs`: dois modos explícitos de aceite com Next real, TLS local, SDK real e funções R67 executadas em PostgreSQL descartável.
- Inventário somente leitura dos ambientes disponíveis e das integrações históricas, sem obtenção de segredos, mudanças hospedadas ou instalação de serviços.

O perfil R68 conserva HTTP loopback, seu manifesto, seus gates e seus relatórios. A escolha R68/R69 está fechada no código. Não existe transporte, perfil, código, CA, agente, headers ou função de DNS configurável pelo manifesto.

## Transporte e identidade do destino

A origem deve ser HTTPS canônica, sem credenciais, caminho, query ou fragmento. Os aliases conhecidos `jenios.com.br` e `www.jenios.com.br`, inclusive com ponto DNS final, são recusados. Essa lista não identifica todas as possíveis origens de produção. Uma origem configurada e um certificado válido ainda não comprovam que o destino é um deployment QA aprovado.

O remetente exige validação de certificado e hostname, recusa `NODE_TLS_REJECT_UNAUTHORIZED=0`, não segue redirecionamentos e usa agente próprio sem proxy ambiente ou reuso de conexão. O prazo total cobre DNS, conexão, TLS, cabeçalhos e corpo; o limite padrão é 3.000 ms, configurável somente entre 50 e 10.000 ms na API de transporte. Corpo de envio: até 262.144 bytes. Resposta: até 8.192 bytes. Falhas, truncamento, tipo de conteúdo ou status inadequados deixam a entrega sem confirmação. A conexão é destruída antes de resolver a falha.

O protocolo de origem mantém as duas assinaturas Ed25519 R67. O ACK continua validado pelo emissor R67 contra o registro persistido; não é um novo recibo assinado. Sua identidade de rede depende do peer TLS e a vinculação semântica depende dos campos R67. O host não recebe nem transmite credenciais administrativas, de banco ou de scheduler.

Referências técnicas primárias: [Node HTTPS](https://nodejs.org/api/https.html), [Node TLS](https://nodejs.org/api/tls.html), [Node 24 HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html) e [NODE_EXTRA_CA_CERTS](https://nodejs.org/api/cli.html#node_extra_ca_certsfile).

## Configuração e execução local explícita

O manifesto `JENIOS_R69_PRIVATE_HOST_CONFIG_V1` tem os mesmos dez campos do R68: `schema`, `coreDirectory`, `outboxDirectory`, `privateKeyFile`, `hmacKeyFile`, `commandsFile`, `scopeId`, `sourceId`, `sourceKeySha256`, `origin`. O arquivo de comandos mantém `JENIOS_R68_PRIVATE_HOST_COMMANDS_V1`. Os diretórios privados continuam 0700 e os arquivos 0600, fora do repositório; permissões, propriedade, links e hashes originais são verificados pelo código existente.

Além de todos os gates QA R67/R68, a execução exige `JENIOS_ROBOT_R69_HTTPS_ENABLED=true`. Execução real, Paper externo e geração paga devem permanecer desativados. A CLI oferece `--check`, `--once` e `--watch`; aceita apenas `--config` para o manifesto protegido. Não instala nem agenda um serviço.

`--check` é offline: verifica arquivos e o diagnóstico existente sem DNS, TLS, HTTP, VM, sessão ou alteração de fila. Com gates desligados, informa `qaConfigurationValid:false`. `--once` e `--watch` recusam execução desabilitada antes de ler o manifesto. Durante a execução, os gates são conferidos em cada tick e antes de cada envio. A parada e a posse do lock são conferidas antes das capturas e dos envios.

Um reinício cria uma nova sessão. Registros já persistidos são retransmitidos exatamente como gravados; isso não restaura o histórico interno do runtime. Locks órfãos continuam retidos. Recuperação automática, exclusão externa de todos os escritores e proteção contra restauração integral de diretório sem testemunha externa não são certificadas.

## Percurso do aceite

No modo privado, a CLI R69 carrega os dois módulos originais verificados pelo R67. O remetente HTTPS alcança um proxy TLS efêmero em loopback, que encaminha para `next start`. A rota R67 existente cria o runtime e o cliente Supabase existentes. O SDK chama um gateway HTTPS local explícito, que executa apenas as funções R67 permitidas em PostgreSQL descartável sob `service_role` e confirma a transação antes de responder.

O gateway representa Auth/PostgREST para esse ensaio. Ele não é Supabase hospedado nem uma instalação real de PostgREST. O administrador, membro, usuário anônimo e token inválido são fixtures declaradas. A aplicação executa seu SDK Auth e suas verificações de acesso reais contra essas respostas simuladas. A separação de escopo depende da configuração explícita do servidor; não se atribui isolamento RLS ao papel `service_role`.

O proxy descarta a primeira resposta somente depois de receber `202/STORED` do Next. O ensaio confere o registro já persistido, reinicia o cliente e exige os mesmos bytes assinados, o mesmo recibo original e `200/ALREADY_STORED`, sem outro lote. O relógio de captura é `Date.now()` real e a admissão usa o relógio PostgreSQL real.

Os dois modos não são intercambiáveis:

| Modo | Fonte | Evidência executável |
|---|---|---|
| `PUBLIC_PROTOCOL_FIXTURE` | Fixture pública assinada | `PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION`; não executa o core original |
| `ORIGINAL_PRIVATE_CORE` | Bytes privados fixados por hash; CLI real | `ORIGINAL_PRIVATE_CORE_SYNTHETIC_EXECUTION`; ausência ou erro dos originais falha sem fallback |

O core original observado fornece Manual, Híbrido e Reverso; não fornece UltraFast. Entradas permanecem sintéticas. Os guardas de 0,65 certificados nos adaptadores R61 não são reatribuídos a esse core histórico. A nova integração não aplica a política automática R65 ao core privado.

O build Next é fornecido antes do aceite. O JSON registra `BUILD_ID`, versões Next/SDK e hashes das rotas compiladas, sem afirmar atestação independente do SHA compilado. Na referência, o build é executado sobre o checkout limpo de referência; a CI pública também compila antes do aceite.

## Verificação e evidências

O R69 acrescenta 22 testes direcionados: 10 de HTTPS, 11 do perfil/CLI e 1 da proteção contra deploy. Cobrem certificado e hostname, redirecionamento, deadline até o fim do corpo, proxy ambiente, limites de resposta, validação antes da requisição, gates e preservação R68. A execução local inicial passou 307/307, incluindo 285 contratos R65–R68 e proteção R60 preservados.

O aceite contém 12 verificações por modo: ligação Next/SDK/RPC/SQL, certificado recusado sem confiança instalada, retransmissão após perda de ACK, assinaturas e relógio reais, acesso administrativo de fixture, recusas antes da leitura, gate desligado e armazenamento R67 isolado. Público e privado passaram 12/12 na preparação. Esses ensaios preliminares usaram checkout alterado e build R68; são registrados como preparação, não como evidência final de referência.

As contagens se sobrepõem. Os direcionados pertencem à suíte geral; os dois modos exercitam os mesmos doze contratos com fontes diferentes. Não representam operações de mercado, amostras de rentabilidade ou 24 ganhos independentes.

O fechamento usa os arquivos `ROBOT_R69_HTTPS_INTEGRATION_CHECKPOINT.json`, `ROBOT_R69_CHANGE_AUDIT.json`, `ROBOT_R69_TARGET_INVENTORY.json` e as evidências de referência pública/privada, todos em `docs/platform/evidence/`. O ledger recebe apenas `httpsPrivateHostIntegration`; os 17 campos/seções existentes são preservados e seus hashes canônicos registrados.

## Descoberta dos ambientes e integração histórica

O projeto Supabase histórico da Platform foi localizado. A consulta somente ao catálogo público não encontrou as relações nem funções R64/R65/R67 previstas. Nenhuma migração foi aplicada. O nome do projeto e sua origem histórica não comprovam isolamento exclusivo para os robôs nem vinculam um deployment aprovado.

A consulta Vercel confirmou zero deployments do SHA R68. A consulta específica de variáveis da branch R68 não retornou entradas; isso não exclui variáveis herdadas. O inventário global de metadados veio truncado, portanto não certifica a configuração completa. Não foram inspecionados valores de segredos nem alteradas variáveis. No workspace Render conectado, o serviço retornado não correspondia à JENIOS; isso não exclui um host em outro workspace ou provedor.

O arquivo privado R45 contém `nucleo-privado/server.mjs` e `app-completa/lib/platform/research-proxy.mjs`, com hashes conferidos nos dois manifestos. O servidor histórico usa `/health` e `/v1/research` e oferece a integração com o serviço original. Não contém a fila durável R67. Não foi executado, reinstalado ou copiado para o repositório. A unidade B214 é de um observador Paper diferente e não é um serviço substituto para o core. O inventário registra os hashes e os limites dessa conclusão, sem publicar os bytes privados.

## Pendências operacionais concretas

1. Identificar e aceitar separadamente o destino QA dedicado e sua vinculação ao deployment; completar a inspeção de metadados e separar chaves de browser, servidor e fonte.
2. Definir o host privado persistente e comprovar custódia, exclusão de escritores, recuperação e testemunha contra restauração de diretório. Nenhum serviço está instalado por este bloco.
3. Em escopo que autorize deploy e migrações, aplicar os esquemas revisados ao destino escolhido e executar a matriz com identidades administrativas reais, tokens inválidos/expirados e escopos recusados.
4. Exercitar transporte, janela do banco e worker no ambiente efetivo. O supervisor R68 e o tick R65 existentes permanecem a base; não foi ativado scheduler hospedado.
5. Definir a origem e proveniência dos dados operacionais antes de clientes. Geração paga exige autorização específica JENIOS; mudanças no core privado exigem seu próprio mapeamento avaliado e reversível.

## Invariantes e regra de fechamento

`actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Ordens reais, Paper externo, chamadas pagas e migrações hospedadas: zero. Monitoramento de clientes e fonte operacional privada: inativos. Produção, merge, deploy e performance comercial não fazem parte da certificação. O losseshômetro continua exclusivamente hipotético/sintético; R15 não recebe backfill.

As evidências conservam o SHA que as produziu. Depois de persistir a referência pública e a execução privada limpa, consolidar documentação e ledger, executar a CI final e criar o backup certificado no mesmo SHA. A correspondência entre CI final, branch e backup fecha o checkpoint sem commits recursivos para inserir a CI do próprio commit.
