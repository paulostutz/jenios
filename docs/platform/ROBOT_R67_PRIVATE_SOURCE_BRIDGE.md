# R67 — fonte privada original conectada à observação durável em QA

## Escopo e base

O R67 implementa a próxima dependência deixada pelo R66: ligar os módulos privados originais já localizados a uma fonte assinada, com fila durável, admissão própria e consulta administrativa em QA isolado. Reaproveita o adaptador B297 e o mecanismo de persistência certificado do R66.

Base consultada antes das alterações:

- Backup: `backup/jenios-robot-r66-durable-emitter-certified-20261024`.
- SHA: `4110b424f09499221d6c7c50c9237ccfe5a47135`.
- CI final: [40117910088](https://github.com/paulostutz/jenios/actions/runs/40117910088), SUCCESS; job `120942986827`.
- Encerramento: 24/10/2026, 17:51:46 UTC, correspondente a 14:51:46 em São Paulo.
- Branch de pesquisa e backup certificado apontavam para o mesmo SHA; deployments desse SHA: zero.

Branch desta revisão: `research/jenios-robot-r67-private-source-bridge-20261024`.

O checkpoint contém a evolução da validação, os hashes das evidências e a regra de fechamento. A classificação de certificação depende da CI do commit consolidado e do backup certificado no mesmo SHA; o checkpoint não precisa ser regravado para citar a própria CI.

## O que está conectado

O percurso implementado é:

1. Ler os dois módulos privados e conferir seus hashes fixos.
2. Compilar exatamente os bytes conferidos e obter um handle identificado internamente pelo loader.
3. Executar `service.analyzeRequest` através de `captureB297OriginalDecisions`, com entradas sintéticas e rede indisponível.
4. Preservar as ações nativas e assinar separadamente o payload e a proveniência do lote.
5. Gravar o lote completo na fila privada antes de retornar a captura ao chamador.
6. Enviar os mesmos bytes ao endpoint R67 no loopback.
7. Admitir o lote atomicamente no PostgreSQL descartável, após conferir assinatura, domínio, escopo, validade e sequência.
8. Consultar as ações originais pelo endpoint administrativo autenticado.

O núcleo privado identificado cobre **Manual, Híbrido e Reverso**. O UltraFast continua no percurso R61/R65 certificado. Nenhuma propriedade do adaptador UltraFast, nem sua política automática de idade de contexto, é atribuída ao executável privado.

## Identidade dos módulos existentes

| Artefato | Identidade fixa |
|---|---|
| `engine.mjs` | SHA-256 `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea` |
| `service.mjs` | SHA-256 `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be` |
| Versão original | `jenios-research-r29.1` |
| Adaptador reaproveitado | `captureB297OriginalDecisions` |
| Registro da descoberta | `docs/platform/evidence/ROBOT_R66_PRIVATE_ENGINE_DISCOVERY.json` |

Os arquivos vêm do backup privado previamente conferido pelo R66. O R67 não reconstrói o motor e não inclui seus bytes no repositório público.

O loader lê arquivos regulares privados, de vínculo único, por descritores sem seguir symlink, com tamanho limitado. Os hashes esperados estão fixos no código; não são parâmetros fornecidos pelo chamador. Os mesmos bytes lidos e conferidos são compilados em memória por `vm.SourceTextModule`. O serviço só pode vincular `./engine.mjs` ao módulo já compilado.

Um handle imitado, um callback arbitrário, uma decisão pronta ou um campo declarado como `verified:true` não obtêm acesso à fonte. O handle legítimo é registrado num `WeakMap` privado. A guarda original `LIVE_DISABLED` precisa passar.

O ensaio local também troca os arquivos de uma cópia privada depois da carga: o handle mantém a captura produzida pelos bytes já compilados, e uma nova carga rejeita os arquivos substituídos. Isso verifica a ligação entre bytes conferidos e bytes executados.

O uso de VM é restrito a estes módulos conhecidos e identificados. Não constitui autorização ou barreira geral para executar código arbitrário. O loader requer Node com `--experimental-vm-modules`; o aviso experimental permanece explícito. Nenhuma função do host, `process`, `require`, `fetch`, filesystem ou timer é entregue à VM. As entradas e saídas atravessam a fronteira em JSON, com timeout e limites de tamanho.

## Domínios que devem continuar separados

| Evidência | Significado |
|---|---|
| `SIGNED_PRIVATE_QA_CAPTURE` | Payload e proveniência R67 assinados pela fonte configurada |
| `ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME` | Origem declarada pela fonte privada, exercitada localmente com os bytes originais |
| `SYNTHETIC_PRIVATE_LAB_ONLY` | Entradas controladas; não representam dados operacionais de clientes |
| `PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION` | Fixture pública que valida contratos; não executa o motor privado |
| `SIGNED_QA_REPLAY` / `R61_SYNTHETIC_RUNTIME` | Percurso R64/R65/R66 anterior, preservado e separado |

A assinatura confirma uma declaração da fonte cuja chave o servidor configurou. O receptor não ganha atestação independente do host ou do executável por receber essa declaração. `independentRuntimeAttestation`, `independentBrokerAttestation` e `independentCustomerConsentVerified` permanecem `false`.

A captura B297 conserva seus campos originais, inclusive `executableBytesVerifiedByAdapter:false` e `originalCallbackIdentityAttested:false`. A verificação local adicional aparece na proveniência externa do R67 e no relatório do loader; os campos históricos não são reescritos para mudar seu significado.

## Protocolo e ações nativas

Um lote contém de 3 a 60 cenários, com pelo menos um de cada modo privado. Os únicos parâmetros dos cenários são `id`, `mode`, `intent`, `horizon` e, opcionalmente, `paused`. O chamador não fornece decisões, fonte de mercado, credenciais, versão de estratégia, geração ou callback.

O payload conserva os cenários e a captura B297 completa. O verificador confere campos exatos, tipos, IDs únicos, correspondência entre entrada e saída, contagens, ações e lados permitidos, versão original, cadeia B297, hashes, tempos e invariantes. A cadeia B297 é verificada recomposta na ordem de campos original, pois usa `JSON.stringify`, enquanto o transporte usa JSON canônico com chaves ordenadas.

Cada lote vincula escopo, fonte, sessão, operação e sequência ao evento. Há duas assinaturas Ed25519 com domínios diferentes, e digests separados do payload, da proveniência e do registro completo.

A ligação `private:r67-v1`, geração `0`, identifica este contrato de integração congelado. Não representa atualização do algoritmo original. O campo `originalVersion` permanece `jenios-research-r29.1`. Não há aplicação automática de candidata a esse núcleo.

As ações são preservadas literalmente. Por exemplo, `reverse_not_calibrated` continua sendo um bloqueio por calibração ausente. O R67 não cria calibração para mudar esse resultado. Prévias e sugestões também não se tornam autorização de ordem.

## Persistência e recuperação

O mecanismo de filesystem, HMAC e locks foi extraído do R66 para `robot-private-durable-file.mjs`. Os perfis são fechados: `R66_OBSERVATION` e `R67_PRIVATE_CAPTURE`. Cada um mantém seus arquivos, locks, domínio HMAC e schema próprios. O contrato público, os erros e os bytes persistidos do R66 são preservados; uma fixture produzida pela implementação certificada compara leitura, repetição e próxima gravação byte a byte.

O R67 usa diretório privado fora do checkout, permissões 0700/0600, arquivos sem links extras, leitura limitada, arquivo temporário sincronizado, substituição atômica e sincronização do diretório. A transação assíncrona mantém o lock durante toda a execução do produtor e até a gravação do lote.

Uma operação repetida com os mesmos inputs retorna o registro persistido, incluindo ambas as assinaturas, antes de executar novamente o motor. Reutilização conflitante da operação é recusada. Um reinício abre nova sessão; ele não inventa histórico anterior do runtime.

A validade de admissão é de **120 segundos**. Um registro vencido permanece na fila como não confirmado; não é redatado ou reassinado. Uma sequência posterior da mesma sessão só pode ser enviada depois do ACK de todas as anteriores. Se a primeira confirmação ficar incerta até vencer, as posteriores daquela sessão ficam retidas, e novas capturas exigem uma sessão nova. Outras sessões válidas podem continuar.

O ACK precisa vincular o registro completo, payload, quantidade de capturas, fonte, sessão, sequência, hashes e domínio. `202/STORED` e `200/ALREADY_STORED` são as únicas confirmações admitidas. ACK parcial, ambíguo ou referente a outro lote mantém a entrega não confirmada.

Locks de processos mortos não são removidos automaticamente. O operador do host deve comprovar exclusividade antes de recuperar o arquivo. Substituir o diretório inteiro por uma cópia antiga válida não é detectado sem testemunho monotônico externo. O bloco não certifica queda de energia, recuperação distribuída ou throughput hospedado.

## HTTP, banco e administração

| Componente | Contrato |
|---|---|
| Entrada | `POST /api/platform/robot-private-observations` |
| Consulta administrativa | `GET /api/platform/admin/robot-private-observations` |
| Tabela | `public.jenios_robot_private_captures_r67` |
| Admissão RPC | `jenios_robot_r67_ingest_private_capture` |
| Consulta RPC | `jenios_robot_r67_read_private_captures` |
| Esquema revisável | `db/schema/robot-r67-private-capture-store.sql` |

Um lote inteiro, seu recibo e ambas as assinaturas ocupam uma única linha. Unicidades por evento, operação e sequência impedem duplicação; locks transacionais serializam operações e sessões, inclusive quando ainda não há linhas. A sequência começa em 1 e não admite lacunas. O relógio real do banco confere a validade depois da aquisição dos locks.

Em repetição exata, o banco retorna o primeiro recibo. Compara todo o registro assinado e o recibo, desconsiderando apenas o novo instante de admissão apresentado na tentativa. Não troca o digest canônico JavaScript por um hash de `jsonb::text`.

As linhas privadas não entram nas tabelas R64, no estudo diário R64, na evolução R65 ou no orçamento de geração. A separação evita contaminar a política UltraFast com decisões de outro motor. RLS e permissões restringem papéis públicos; `service_role` continua sendo um papel confiável que ultrapassa RLS, e a aplicação fixa escopo e fonte explicitamente.

O GET administrativo exige token validado e permissão `platform.admin`, retorna no máximo 30 lotes do escopo configurado e não aceita seleção de escopo por query string. Não há mutação administrativa R67 nem feed embutido em HTML anônimo. A autenticação real hospedada ainda depende da homologação apropriada.

O transporte fornecido aceita apenas HTTP em endereço literal de loopback e porta explícita, com caminho fixo. Bloqueia DNS, destinos hospedados, credenciais e redirecionamentos; limita requisição, corpo da resposta e tempo total. Um sender personalizado continua sendo dependência confiável do host e precisa cumprir o prazo tanto da requisição quanto da leitura do corpo.

## Configuração preparada, sem ativação hospedada

A habilitação do receptor requer a fronteira QA existente, `JENIOS_ROBOT_R67_ENABLED=true` e `JENIOS_ROBOT_ANALYST_PAID_ENABLED=false`. Produção, execução real e Paper externo continuam bloqueados.

A identidade usa `JENIOS_ROBOT_R67_SCOPE_ID`, `JENIOS_ROBOT_R67_SOURCE_ID` e `JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY`, configurados no servidor. Fonte e chave devem ser distintas das configuradas para R64/R65; a comparação das chaves usa os bytes DER. O corpo HTTP não escolhe essa identidade.

A chave privada e o segredo HMAC pertencem ao host privado, fora do repositório. O código da fonte só admite o domínio sintético original. Nenhum worker, cron, serviço ou agendamento hospedado foi ativado.

## Validação e rastreabilidade

Há duas linhas de evidência que não devem ser confundidas:

1. **Execução privada original local:** o script `r67-private-source-acceptance.mjs` carrega os bytes retidos, usa processos separados, HTTP real em loopback e PostgreSQL descartável exclusivo `jenios_r67_private_qa`. O teste demonstra captura, persistência, perda do ACK após commit, morte do processo, repetição exata, nova sessão e leitura administrativa. A identidade administrativa é deliberadamente simulada. Não testa o servidor Next completo, Auth hospedado ou PostgREST hospedado.
2. **CI pública:** valida contratos e fixtures explicitamente identificadas, controles negativos do loader, compatibilidade da fila, HTTP, permissões, concorrência e admissão PostgreSQL. Não contém ou executa os módulos privados. Executa também os contratos herdados, testes gerais e build.

O ensaio privado preliminar passou em 17/17 casos e persistiu 3 lotes com 9 decisões em 2 sessões. As 6 decisões adicionais usadas na prova separada do loader são registradas à parte e não são somadas aos registros admitidos. A referência definitiva será produzida sobre um commit limpo identificado pelo relatório.

As contagens das baterias se sobrepõem: os testes direcionados também estão nos gerais. Quantidades de testes, lotes e decisões sintéticas não são operações independentes de mercado.

Evidências e fechamento são registrados em:

- `docs/platform/evidence/ROBOT_R67_PRIVATE_SOURCE_BRIDGE_CHECKPOINT.json`.
- `docs/platform/evidence/ROBOT_R67_CHANGE_AUDIT.json`.
- `docs/platform/evidence/ROBOT_R67_PRIVATE_SOURCE_ACCEPTANCE_EVIDENCE.json` após o ensaio definitivo.
- `docs/platform/evidence/ROBOT_R67_POSTGRES_ACCEPTANCE_EVIDENCE.json` após a CI de referência.
- Nova seção `privateSourceBridge` do ledger, preservando os valores das 15 seções anteriores.

## Limites preservados e próxima dependência

Ordens reais, Paper externo e chamadas pagas permanecem em zero. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem nulos. Monitoramento de clientes e fonte operacional privada continuam inativos. Não houve merge, deploy, migração hospedada, purga física ou alteração de produção.

Os invariantes certificados dos quatro robôs, inclusive controle manual, guard de alinhamento 0.65 dos adaptadores certificados, reversão seletiva e Losseshômetro exclusivamente sintético, são preservados. O R67 não atribui retroativamente esses detalhes ao núcleo privado antigo nem certifica rentabilidade.

A próxima dependência é a homologação do host privado e do ambiente QA hospedado: identidade administrativa real, custódia das chaves, recuperação de fila, banco isolado, dados operacionais com proveniência e execução controlada do scheduler. O plano R66 permanece a referência de preparação, agora complementado por esta ponte concreta. Aplicar esquemas hospedados ou ativar serviços continua fora da autorização deste bloco. Qualquer integração paga depende de autorização específica da JENIOS.
