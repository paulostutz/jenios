# R71 — contrato efetivo de configuração e identidade

Base lida: `3fb6e9c4335422440d149fd969907e9eddc840c6`. Revisão somente leitura; nenhuma configuração real, credencial ou serviço foi consultado.
Este documento descreve exigências do código, não valores observados nem autorização para ativação. Sem implementação, testes ou chamadas remotas.

## 1. Matriz de variáveis

**N** = receptor Next R71; **H** = execução do host privado R71 em `--once/--watch`; **S** = endpoint scheduler R71, dentro do Next.
“—” = o componente não lê essa variável para esse contrato. Strings `true`/`false` são literais; ausência não equivale a `false`.
“PF/estado” = preflight R70 e consulta assinada de estado R71; essa exigência adicional não é aplicada ao intake/admin/scheduler.

| Variável | N | H | S | Evidência |
|---|---|---|---|---|
| `VERCEL_ENV` | `preview` | `preview` | `preview` | [A] |
| `JENIOS_QA_CANDIDATE_ENABLED` | `true` | `true` | `true` | [A] |
| `JENIOS_ROBOT_QA_ENABLED` | `true` | `true` | `true` | [A] |
| `JENIOS_REAL_EXECUTION_ENABLED` | `false` | `false` | `false` | [A] |
| `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED` | `false` | `false` | `false` | [A] |
| `JENIOS_PRIVATE_PAPER_EXECUTOR` | `false` | `false` | `false` | [A] |
| `JENIOS_ROBOT_ANALYST_PAID_ENABLED` | `false` | `false` | `false` | [A] |
| `JENIOS_ROBOT_R67_ENABLED` | `true` | `true` | `true` | [A] |
| `JENIOS_ROBOT_R71_ENABLED` | `true` | `true` | `true` | [A,H] |
| `JENIOS_ROBOT_R68_HOST_ENABLED` | — | `true` | — | [H] |
| `JENIOS_ROBOT_R69_HTTPS_ENABLED` | — | `true` | — | [H] |
| `JENIOS_ROBOT_R70_PREFLIGHT_ENABLED` | `true` em PF/estado | `true` | — | [P,H] |
| `VERCEL_TARGET_ENV` | `preview` em PF/estado | — | — | [P] |
| `VERCEL_URL` | hostname sem scheme/barra/query/hash em PF/estado | —; usa pins | — | [P] |
| `VERCEL_PROJECT_ID` | `prj_` + 1–80 alfanuméricos em PF/estado | —; usa pins | — | [P] |
| `VERCEL_DEPLOYMENT_ID` | `dpl_` + 1–80 alfanuméricos em PF/estado | —; usa pins | — | [P] |
| `VERCEL_GIT_COMMIT_SHA` | 40 hex minúsculos em PF/estado | —; usa pins | — | [P] |
| `JENIOS_ROBOT_R67_SCOPE_ID` | `scope:` + 16 hex minúsculos | —; usa manifesto | mesma exigência de N | [A,R] |
| `JENIOS_ROBOT_R67_SOURCE_ID` | `source:` + 16 hex minúsculos | —; usa manifesto | mesma exigência de N | [A,R] |
| `JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY` | PEM Ed25519 | —; deriva da chave privada | mesma exigência de N | [A,R,H] |
| `PLATFORM_SUPABASE_URL` | presente, URL HTTPS com hostname | — | mesma exigência de N | [D] |
| `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` | presente; somente servidor | — | mesma exigência de N | [D] |
| `NEXT_PUBLIC_PLATFORM_SUPABASE_URL` | build do cliente administrativo | — | — | [I] |
| `NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY` | build do cliente; nunca service-role | — | — | [I] |
| `PLATFORM_ADMIN_USER_IDS` | opcional: UUIDs administrativos separados por vírgula | — | — | [I] |
| `JENIOS_ROBOT_R71_ADMIN_ORIGIN` | obrigatório para POST administrativo | — | — | [A,O] |
| `JENIOS_ROBOT_R71_SCHEDULER_TOKEN` | somente S | — | 32–256 caracteres, sem whitespace | [A,S] |
| `JENIOS_ROBOT_R65_SCHEDULER_TOKEN` | comparação de separação em S | — | se existir, não pode igualar o token R71 | [A] |
| `JENIOS_ROBOT_R64_ENABLED`, `JENIOS_ROBOT_R65_ENABLED` | não exigidos; ver separação abaixo | — | mesma regra de N | [A] |
| `JENIOS_ROBOT_R64_SOURCE_ID`, `JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY` | condicionais, conforme abaixo | — | mesma regra de N | [A] |
| `NODE_TLS_REJECT_UNAUTHORIZED` | não há guarda específica R71 no SDK | não pode ser `0` | não há guarda específica R71 no SDK | [T] |

Se R64 ou R65 estiver habilitado, a configuração antiga precisa conter source ID válido e chave pública. O source ID R67 não pode coincidir com o R64; as chaves, comparadas por bytes SPKI, devem ser diferentes. Mesmo sem R64/R65 habilitados, uma identidade antiga fornecida não pode coincidir. [A]
R71 reutiliza intencionalmente a identidade privada R67; não existem variáveis `R71_SCOPE_ID`/`R71_SOURCE_PUBLIC_KEY` neste contrato. [A,R]
Não há variável `JENIOS_ROBOT_R71_WORKER_ENABLED` no código. `JENIOS_ROBOT_R68_WORKER_ENABLED` pertence ao supervisor R65, não habilita o ciclo R71. [W]

## 2. Host privado: arquivos, custódia e pins

CLI existente: `scripts/platform/research/r71-private-host.mjs --check|--once|--watch --config <caminho-absoluto>`. Não instala serviço. [H]
Em `--check`, o resultado informa `qaConfigurationValid` e o diagnóstico da fila; exit 0 sozinho não prova gates válidos ou fila pronta, pois a CLI decide esse exit pelo hash do core. [H]
O loader exige `vm.SourceTextModule`; a execução Node precisa disponibilizá-lo (nos aceites, `node --experimental-vm-modules`). `--check` não executa o core. [L,H]
Manifesto exato `JENIOS_R71_PRIVATE_HOST_CONFIG_V1`: `schema, coreDirectory, outboxDirectory, privateKeyFile, hmacKeyFile, commandsFile, scopeId, sourceId, sourceKeySha256, origin, targetPinsFile`. Não admite campos adicionais. [H]
Arquivos e diretórios devem ficar fora do repositório e do cwd, usar caminhos absolutos canônicos sem symlinks; diretórios privados 0700, arquivos regulares 0600, dono = UID do processo, um hardlink. [F]
A chave privada é Ed25519; seu fingerprint SHA-256/SPKI deve coincidir com manifesto/pins/receptor. HMAC: 64 hex minúsculos, newline final opcional. Não são envs do receptor. [H]
O core permanece externo: `engine.mjs` e `service.mjs` devem coincidir com os hashes fixados B297; não há fallback para reimplementação. [L,H]
Comandos: `JENIOS_R71_PRIVATE_HOST_COMMANDS_V1`, até 20 itens `{operationId, scenarios, positionContexts}`. Não aceitam seleção de versão/política nem código. [H]
Pins: `JENIOS_R70_TARGET_PINS_V1` com `schema, origin, projectId, deploymentId, commitSha, scopeId, sourceId, sourceKeySha256`; os quatro vínculos locais origin/scope/source/fingerprint são cruzados. [P,H]
Origem permitida: HTTPS canônico, sem credenciais/path/query/hash; IP literal loopback ou um único label `*.vercel.app` sem porta não padrão. Isso não prova deployment imutável ou aprovado. [P]
TLS exige certificado/hostname válidos, não segue redirects, não usa proxy ambiente nem aceita CA/headers/callbacks pelo manifesto. `NODE_EXTRA_CA_CERTS` é mecanismo Node de startup usado nas fixtures locais, não requisito de QA hospedada. [T]
Preflight precede loader/sessão; consulta de estado assinada precede novas capturas; preflight precede cada flush. Fila/lease duráveis não autorizam recuperar locks órfãos nem restaurar diretório antigo. [H]
O disco persistente, custódia operacional, processo único e testemunho externo contra restauração ainda precisam evidência do host real; filesystem efêmero de função não satisfaz persistência.

## 3. Scheduler e estado persistido

Endpoint: `POST /api/platform/internal/robot-private-evolution`; sem query e sem corpo; `Authorization: Bearer <token-R71>` com comparação exata. Não usa identidade administrativa nem Origin. [S]
O chamador externo necessita destino QA exato e token em custódia; nenhum nome de env, cron ou serviço do chamador foi definido no código.
O endpoint herda gates/fonte/banco da coluna S e chama `runR71EvolutionTick`; o token por si só não cria agendamento. [R,S,W]
Existe CLI explícita: `node scripts/platform/research/r71-cycle-worker.mjs`, sem argumentos; chama uma vez `createR71Runtime(process.env).runTick()` e imprime `JENIOS_R71_WORKER_RESULT_V1`. Não tem `--check`/`--watch` nem exige token HTTP ou Origin. [W]
A CLI usa os gates/fonte/banco da runtime e pode inicializar/avançar estado durável. Existe `nextAtMs` no resultado; no checkout não há supervisor contínuo R71 nem cron R71 registrado. Instalação hospedada não foi observada. [R,W,V]
`robot-r68-cycle-supervisor.mjs` aceita estados/invariantes R65 e não é adaptador automático R71. Inicialização R71 é explícita por CLI, TICK administrativo ou scheduler. GET administrativo/consulta da fonte não inicializam; fonte sem estado recebe indisponibilidade. [R,W]
Dependências de esquema: `db/schema/robot-r67-private-capture-store.sql` e extensão `db/schema/robot-r71-private-evolution-store.sql`; não foram aplicadas a banco hospedado neste escopo.
O service-role é confiável e contorna RLS; adapter/RPC vinculam scope/source/fingerprint. Não afirmar isolamento de service-role pela RLS. [R]

## 4. Identidade administrativa Platform real

Servidor valida o bearer com `db.auth.getUser(token)` no banco Platform configurado; usuário ausente/inválido/anônimo → 401. R71 também exige ID no formato UUID minúsculo aceito pelo handler. [I,O]
`platform.admin` vem de `PLATFORM_ADMIN_USER_IDS` **ou** `user.app_metadata.platform_role === 'admin'`; `user_metadata` não concede administração. [I]
A tabela `jenios_platform_admin_permissions` só pode conceder `platform.reports` neste helper; inserir `platform.admin` nela não satisfaz o endpoint R71. [I]
Matriz futura de GET real: administrador Platform → 200/feed do escopo; membro e reports-only → 403; anônimo, token inválido/expirado → 401. Erro de serviço/consulta de permissões → 503, não prova negação por role.
As credenciais e usuários devem pertencer ao mesmo projeto Platform QA de backend/frontend; isso exige comprovação externa, não apenas strings configuradas. Não há fallback Social no cliente R71. [D,I]
O cliente usa `jenios-platform-auth-v1`, obtém sessão Platform e envia bearer ao endpoint; limpa o feed ao logout/troca de usuário. O HTML anônimo contém somente shell, sem consulta de banco ou feed. [I,O]
POST administrativo exige origin canônica configurada: HTTPS, ou HTTP apenas loopback; Host/Forwarded não escolhem a origem. Origin presente deve ser idêntica; ausência de Origin é aceita para API bearer, por contrato herdado. GET não exige Origin. [A,O]
A origem administrativa não é derivada automaticamente de `VERCEL_URL` nem cruzada com os pins R70; o operador deve vinculá-la à origem QA aprovada.
R71 não cria usuários, sessões, permissões ou login flow. Os aceites anteriores usaram Auth gateway/sessões explicitamente simulados; identidade hospedada permanece não certificada.

## 5. Pendências e distinções necessárias

O handoff `robot-r68-declared-handoff.mjs` é offline/declaratório, contém matriz R65/R67 e variáveis desses blocos; não valida as rotas, flags, manifesto, estado ou identidade R71. [W]
Gates R71 permitem intake/admin/scheduler sem metadata/preflight R70; o percurso completo do host exige ambos. Não relatar “R71 habilitado” como prova de conexão ponta a ponta. [A,O,P,H]
Nenhum gate de env comprova deployment SHA, namespace QA, volume persistente, custódia, usuário real ou permissão do proprietário. O inventário herdado Vercel continua separado e incompleto.
Planejamento de execução do scheduler, provisionamento QA, aplicação hospedada revisada e matriz Auth real permanecem pendentes, sem autorização implícita neste pacote.
A política R71 é somente wrapper externo de contexto de posição Híbrido/Reverso em QA; Manual e core original permanecem preservados. R65/UltraFast 750→500 ms é política independente. Nenhum provedor generativo é exigido para este percurso.

## 6. Evidências de código

[A] `lib/platform/research/robot-r61-qa-access.mjs`; `robot-r67-access.mjs`; `robot-r71-access.mjs`; `robot-r65-cycle-access.mjs` no mesmo diretório.
[R] `lib/platform/research/robot-r71-runtime.mjs`; `robot-r71-database-store.mjs`.
[P] `lib/platform/research/robot-r70-preflight-http.mjs`; `robot-r70-preflight-protocol.mjs`; `robot-r71-private-protocol.mjs`.
[H] `lib/platform/research/robot-r68-private-host.mjs`; fachada `robot-r71-private-host.mjs`; `scripts/platform/research/r71-private-host.mjs`.
[F] `lib/platform/research/robot-r68-private-files.mjs`; `robot-r68-outbox-doctor.mjs`.
[L] `lib/platform/research/robot-r67-private-core-loader.mjs`; `b297-private-readonly-audit.mjs`.
[T] `lib/platform/research/robot-r69-https-transport.mjs`; `robot-r71-https-transport.mjs`.
[D] `lib/platform/admin-db.mjs`.
[I] `lib/platform/admin-permissions.mjs`; `lib/platform/supabase-client.js`; `app/components/platform/PlatformRobotPrivateEvolutionAdmin.js`.
[O] `lib/platform/research/robot-r71-http.mjs`; `app/api/platform/admin/robot-private-evolution/route.js`; `app/platform/homologacao/robos/privado/page.js`.
[S] `lib/platform/research/robot-r71-http.mjs`; `app/api/platform/internal/robot-private-evolution/route.js`.
[W] `lib/platform/research/robot-r71-cycle-worker.mjs`; `robot-r68-cycle-supervisor.mjs`; `robot-r68-declared-handoff.mjs`; `scripts/platform/research/r71-cycle-worker.mjs`.
[V] `vercel.json`: sem crons; branches de pesquisa/backup R71 com deployment desabilitado.
