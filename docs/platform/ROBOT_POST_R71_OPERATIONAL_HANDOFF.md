# Robôs JENIOS — passagem do R71 para homologação hospedada

## Resultado e limite deste fechamento

**Preparação operacional concluída; homologação hospedada pendente.** Este pacote reúne o alvo identificado, as dependências exatas, a configuração exigida pelo código, o roteiro de execução e a evidência que falta obter. Não cria outra certificação sintética. O R71 permanece encerrado e é a base funcional a reutilizar.

O usuário manteve neste chat as restrições de não fazer merge, deploy, alteração de produção, migração em banco hospedado, ordens reais, Paper externo, chamadas pagas ou ativação de clientes. As mensagens de continuidade autorizam a preparação, a revisão e a consulta somente leitura; não removem essas proibições expressas.

`operationalReady=false`, `hostedAuthenticationCertified=false`, `privateOperationalSourceActive=false` e `customerMonitoringActive=false`. Nenhum resultado deste pacote representa PnL, acurácia financeira ou perdas reais evitadas.

## Base conferida antes das alterações

| Referência | Valor |
|---|---|
| Repositório | `paulostutz/jenios` |
| Base certificada R71 | `3fb6e9c4335422440d149fd969907e9eddc840c6` |
| Pesquisa R71 preservada | `research/jenios-robot-r71-private-evolution-20261024` |
| Backup R71 preservado | `backup/jenios-robot-r71-private-evolution-certified-20261024` |
| CI final R71 | [40135970938](https://github.com/paulostutz/jenios/actions/runs/40135970938), `SUCCESS`, mesmo SHA |
| Job final R71 | `120997436150`, concluído em 2026-10-24T21:54:51Z |
| Pesquisa deste pacote | `research/jenios-robot-operational-handoff-20261024` |
| Backup deste pacote | `backup/jenios-robot-operational-handoff-prepared-20261024` |
| Classificação do novo backup | `PREPARED_WITH_EXTERNAL_DEPENDENCIES`; não é certificação hospedada |

Foram consultados checkpoint, ledger, documentação, referências remotas e CI R71 antes da primeira alteração. Os JSONs R71 continuam atribuídos ao SHA produtor `5b32d99812eb61a37b4058951d15d531260edfe9`; a consolidação certificada permanece em `3fb6e9c4335422440d149fd969907e9eddc840c6`. Não há reatribuição nem novo ciclo de commits para registrar a própria CI.

As 20 seções/campos anteriores do ledger são preservadas integralmente. A nova seção `operationalHandoffPreparation` registra preparação e pendências, sem aumentar contagens de testes ou promover status operacional. Código, esquemas SQL, workflows e evidências de certificação anteriores permanecem inalterados.

## O que já está resolvido

O motor privado original foi localizado nos backups e sua execução foi comprovada no R71. Os bytes privados não precisam ser reconstruídos nem publicados. A versão histórica `jenios-research-r29.1` fornece Manual, Híbrido e Reverso; UltraFast continua no caminho R61/R65.

O R71 já implementa fonte contextual assinada, fila persistente, retransmissão exata, consulta vinculada a versão/geração, estudo completo, plano prospectivo, avaliação de oito casos, aplicação limitada e rollback. O core original participou do ensaio local com PostgreSQL descartável e endpoints reais do Next. Entradas e posições eram sintéticas, assim como a identidade administrativa usada no navegador. A operação hospedada não foi certificada por esse ensaio.

A política privada existente continua limitada a encaminhar `positionOpen` para Híbrido/Reverso em QA. Não retoca o core, parâmetros financeiros, estratégia de todos os robôs ou aprendizado arbitrário. Manual permanece sob controle do operador; o guard 0,65 e os demais invariantes já certificados não são ampliados por este documento.

## Inventário e impedimentos concretos

| Dependência | Identificação / situação | Condição para encerrar |
|---|---|---|
| Projeto Vercel | `jenios-ecossistem`, projeto `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4`, equipe `team_yDZgXm0NnWvHwT6xUijH3xn0` | Selecionar um deployment QA autorizado com identidade completa e SHA exato |
| Deployment R71 | Consulta autenticada por SHA final retornou zero, sem filtro de estado ou target | Existência e aceite do deployment; não substituir por um alias ou por outro commit |
| Configuração Vercel | Lista global anterior truncada; consulta de branch não prova configuração herdada | Aquisição completa de metadados do projeto e variáveis compartilhadas aplicáveis, sem segredos |
| Banco Platform | Projeto identificado `jenios-platform-homologacao`, ref `xaicvhagftzjkqphnbgx`, região `sa-east-1`; a listagem compacta de `public` não retornou as 16 tabelas esperadas | Conferir funções/permissões, aceitar o isolamento e autorizar a preparação hospedada; nome do projeto não comprova exclusividade dos robôs |
| Host privado | Não identificado/aceito nos artefatos examinados | ID de recurso, operador, runtime, volume, custódia, exclusão externa e testemunha independente |
| Administração | Guard Platform e painel já implementados | Matriz com identidade real no alvo aceito, sem sessão injetada |
| Agendamento | Tick R71 e endpoint próprios já implementados; nenhum scheduler hospedado aceito | Controlador identificado, configuração R71, política de wake e desligamento observável |
| Fonte operacional | Caminho atual exige entradas sintéticas B297 | Contrato e proveniência do hook operacional existente, em escopo específico posterior |

Os resultados de catálogo e a ordem dos esquemas estão em `evidence/ROBOT_POST_R71_HOSTED_DATABASE_PLAN.json`. O inventário consolidado e seus limites estão em `evidence/ROBOT_POST_R71_OPERATIONAL_INVENTORY.json`.

O control plane retornou `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.003` e lista vazia de branches. O SELECT detalhado de catálogo não retornou e foi interrompido pelo assistente após 483,7 segundos, sem nova tentativa desse SELECT. Uma consulta distinta, `supabase_list_tables` somente para `public` e sem detalhes de colunas, retornou seis tabelas em 1,5 segundo: nenhuma correspondeu às 16 tabelas esperadas R64/R65/R67/R71. Foram persistidos apenas a contagem total e os nomes esperados dos robôs, sem nomes, comentários ou contagens de linhas das demais tabelas. O catálogo de funções, as definições e as permissões atuais continuam não verificados; essa listagem não constitui aceite de instalação.

### Por que a configuração não foi declarada completa

O schema do conector `vercel_filter_project_envs` não oferece paginação, filtro por nome ou projeção de campos. A listagem global anterior veio truncada. Repetir a mesma consulta ou obter uma lista vazia de overrides não resolve a herança. Os endpoints individuais disponíveis retornam valores descriptografados e não foram usados.

Há um caminho condicional pela CLI oficial já autenticada, com `decrypt=false`, projeção de metadados antes de qualquer saída e consulta separada às variáveis compartilhadas vinculadas ao projeto. A CLI não está disponível neste workspace, sua autenticação não foi presumida, e o caminho não foi executado. As APIs documentadas incluem `value`; não existe promessa de exclusão de bytes de valores no servidor. O plano detalhado e suas condições estão em `evidence/ROBOT_POST_R71_VERCEL_METADATA_QUERY_PLAN.json`.

Um inventário completo de nomes também não comprovaria valores de flags, vínculo das credenciais, isolamento ou identidade administrativa. Essas são verificações distintas no ambiente aceito.

## Reutilização exata

| Necessidade | Componente existente | Limite a respeitar |
|---|---|---|
| Inspeção offline do host | `scripts/platform/research/r71-private-host.mjs --check --config <arquivo>` | Não inicia VM, sessão ou rede; não aceita por si só o host externo |
| Fonte persistente | A mesma CLI, com `--once` ou `--watch`, lifecycle R68 e perfil R71 | Esses modos produzem efeitos, mesmo com comandos vazios |
| Diagnóstico da fila | Doctor R68 com perfil `R71_PRIVATE_EVOLUTION` | Somente leitura; não remove lock, não promove temporário, não re-assina |
| Identidade do alvo | `scripts/platform/research/r70-target-snapshot.mjs` | Consistência do JSON não substitui aquisição autenticada |
| Compatibilidade do peer | Preflight R70 e transporte R71 | Desafio TLS não atesta banco, host ou identidade Auth |
| Estudo e evolução | `scripts/platform/research/r71-cycle-worker.mjs` | Uma invocação explícita; não instala agendamento |
| Administração | `/api/platform/admin/robot-private-evolution` e `/platform/homologacao/robos/privado` | Sessão Platform real, relatório mínimo, origem canônica e rollback por revisão/digest |
| Scheduler HTTP | `POST /api/platform/internal/robot-private-evolution` | Token R71 exclusivo; assinatura de fonte ou sessão de cliente não substitui esse token |

O `r68-declared-handoff` examina configuração R64/R65/R67 e não cobre integralmente R71. O `r68-cycle-supervisor` envolve o tick R65. Nenhum desses resultados ou executáveis será renomeado como homologação/supervisão R71. A composição do tick R71 com um controlador depende da escolha do host; não se cria outro supervisor sem conhecer esse ambiente.

## Roteiro único de execução futura

### 1. Fixar recursos e escopo

Registrar provedor/conta e ID imutável do host, volume persistente, responsável, usuário de execução, mecanismo de exclusão de instâncias antigas e testemunha externa contra rollback integral da fila. Registrar também o projeto QA de banco escolhido, o deployment Vercel aceito e o SHA do código.

O projeto Supabase já identificado é um candidato existente, sujeito à decisão de isolamento. Não há autorização implícita para criar outro projeto, contratar armazenamento ou usar um serviço de outro produto. A busca anterior no workspace Render conectado não encontrou serviço JENIOS; isso não exclui outro workspace ou provedor e não foi repetido como nova evidência.

### 2. Preparar banco e configuração, sem ativação automática

Reutilizar a ordem, os hashes e as dependências do plano de banco. Aplicação hospedada só ocorre após autorização específica para o alvo aceito. Não executar os scripts de aceitação PostgreSQL locais contra Supabase: eles são desenhados para bancos descartáveis e podem criar/remover fixtures, papéis e objetos.

A trilha privada mínima é `robot-r67-private-capture-store.sql` → `robot-r71-private-evolution-store.sql`. A trilha R65 é separada: `robot-r64-operational-store.sql` → `robot-r65-lifecycle-store.sql`. Para o pacote completo, a ordem revisável é R64 → R65 → R67 → R71; R68–R70 não exigem outro esquema. Os quatro arquivos e os hashes esperados dos 39 corpos de função foram conferidos estaticamente. Isso não equivale a comparar os objetos de um banco instalado. Cada arquivo tem sua própria transação; `IF NOT EXISTS` não certifica equivalência de uma tabela já existente.

Revisar o contrato de ambiente em `ROBOT_POST_R71_ENVIRONMENT_CONTRACT.md`. Separar host, receptor Next e scheduler. A chave privilegiada do banco permanece no backend; o host de captura não a recebe. A fonte R67/R71 tem identidade e chave distintas da fonte R64/R65. Tokens, chaves e sessões não entram neste pacote, no chat, no Git ou em logs.

Manter o conjunto QA fechado: produção, ordens, Paper externo, geração paga e monitoramento de clientes desativados. Os gates específicos só são habilitados no alvo QA depois de definidos o isolamento e o aceite de execução.

### 3. Aceitar host e destino antes da captura

O plano `ROBOT_POST_R71_HOST_ACCEPTANCE_PLAN.md` contém os campos exatos dos manifests e as evidências de host/volume/custódia. Os placeholders são deliberadamente inválidos; não representam instalação pronta ou recurso existente.

No host selecionado, executar a inspeção offline, verificar bytes do core, propriedade/permissões, inventário completo e estável, ausência de locks/temporários e HMAC da fila existente. Uma fila nova sem snapshot não é prova de HMAC de registros. Não remover um lock apenas por idade ou suposta morte de processo.

Adquirir metadata autenticada completa do deployment, comparar equipe/projeto/repo/SHA/URL e executar o desafio do peer. Não trocar SHA, origem ou identidade ao receber recusa. O receptor só é elegível depois de banco, configuração e identidade aceitos.

### 4. Aceitar identidade e inicializar o ciclo R71

Executar a matriz abaixo com contas reais da Platform. O guard usa `db.auth.getUser(token)` e exige `platform.admin`. A concessão administrativa vem de configuração server-side ou `app_metadata.platform_role=admin`; a tabela de permissões concede somente relatórios. Não há pedido para alterar permissões de usuários existentes neste pacote.

| Caso | Resultado exigido |
|---|---|
| Anônimo no HTML | Somente shell, sem relatório administrativo |
| Anônimo / token inválido ou expirado no endpoint | Recusa, sem dados administrativos |
| Membro comum | Recusa administrativa |
| Usuário somente de relatórios | Recusa administrativa |
| Administrador real da Platform | Relatório do escopo correto, sem capturas/chaves/assinaturas completas |
| Administrador com Origin incorreto | Mutação recusada, sem mudança de estado |
| Administrador com Origin canônico | Ação QA autorizada e auditável; no ROLLBACK, revisão/digest esperados obrigatórios |
| Troca ou saída de conta no painel | Relatório anterior removido |
| Assinatura/identidade da fonte, sem bearer exclusivo, no endpoint de scheduler | Recusa |
| Token R71 de scheduler exclusivo | Tick autorizado somente com gates QA e configuração válidos |

O contrato herdado aceita POST bearer sem header Origin quando a origem canônica está configurada. Um Origin presente deve ser idêntico ao configurado; Host/Forwarded não podem escolhê-lo. O TICK administrativo aceita a ação `TICK`; `expectedRevision` e `previousDigest` são argumentos do ROLLBACK, não campos obrigatórios do TICK.

Inicializar o estado R71 por tick administrativo, scheduler explícito ou `node scripts/platform/research/r71-cycle-worker.mjs` (sem argumentos, com configuração backend válida) antes de esperar que a fonte leia uma versão ativa. A CLI efetua um tick durável, não uma inspeção. A consulta de estado da fonte não inicializa o histórico. Usar um escopo QA aceito para as ações mutáveis de aceite; não reutilizar um histórico de cliente.

### 5. Executar o aceite hospedado mínimo e encerrar

Usar os componentes já certificados para observar a CLI R71 efetiva, a fila no volume real, o receptor QA, o PostgreSQL hospedado escolhido e a identidade administrativa real. Comprovar transmissão, persistência/reinício, retry exato, consumo de versão/geração e rollback com histórico preservado. Registrar o que foi executado e o que permaneceu fixture; não transportar automaticamente os números do R71 para esse ambiente.

O controlador R71 deve respeitar `nextAtMs` e a janela registrada. O host precisa estar disponível antes de abrir o plano, pois a captura prospectiva acontece na fonte; a janela perdida é rejeitada, sem backfill. Um cron ou supervisor antigo não é prova dessa coordenação.

Depois desse aceite, dados operacionais e eventual provedor generativo ainda dependem de contrato/escopo próprios. O caminho B297 sintético atual não pode receber dados de clientes e continuar sendo apresentado como uma integração operacional certificada. O hook operacional existente deve ser identificado e vinculado ao core já localizado, sem reconstrução por inferência. O fallback determinístico e o contrato limitado de hipótese continuam suficientes para QA sem custo.

## Dados externos que faltam para executar o roteiro

| Informação ou decisão | Estado neste fechamento |
|---|---|
| Host privado e volume existentes: provedor, IDs e responsável | Não fornecidos/não comprovados |
| Mecanismo externo de exclusão e testemunha monotônica | Não fornecidos/não comprovados |
| Confirmação do banco QA e isolamento dos robôs | Pendente; candidato identificado e catálogo consultado |
| Caminho autorizado de aquisição completa da configuração Vercel | Pendente de capacidade/acesso adequado |
| Autorização específica para deploy QA e migrações no alvo escolhido | Não concedida; vedados expressamente neste chat |
| Contas de teste reais e aceite operacional do proprietário | Pendentes; sem solicitar credenciais em texto |
| Componente/hook de dados operacionais e seu escopo | Não aceito; não necessário para concluir a preparação QA |

Essas dependências não se resolvem repetindo testes sintéticos. O próximo passo é identificar/aceitar os recursos existentes e autorizar o escopo hospedado concreto. Até isso ocorrer, o fechamento correto é preparação salva, com homologação hospedada pendente.

## Verificação e salvamento

Este fechamento faz revisão cruzada dos documentos, valida os JSONs, confere os hashes dos esquemas e a preservação de cada seção anterior do ledger. Não altera implementação nem executa nova bateria sintética, build, migração ou CI de certificação.

As duas branches deste pacote ficam sob as exclusões existentes `research/jenios-robot-*` e `backup/jenios-robot-*` da política Vercel. Nenhum workflow de push do checkout corresponde a esses nomes. Após salvar, conferir SHA de pesquisa/backup, árvore local limpa, R71 preservado e deployments por SHA. Registrar a conclusão externa sem criar commits recursivos.

`actualBrokerPnl=null`, `actualLossesAvoided=null`, `realTradeAccuracy=null`. Ordens reais, Paper externo, chamadas pagas, deploys executados por este trabalho, merges, migrações hospedadas e ativação de clientes: zero.
