# JENIOS R80 — checkpoint técnico em andamento — 27/10/2026

## Escopo e preservação
- Exclusivamente JENIOS Platform `xaicvhagftzjkqphnbgx`; não modificar CHEFE, LETTER, Social, PAY, núcleo proprietário R74, app M02 ou a release publicada R79.
- Base de produção imutável: `release/jenios-genios-g44-20261024` / `a24922cc829dd1b45b87a719e9fd57ab45e6d79b`.
- Desenvolvimento: `fix/jenios-r80-private-paper-safety-20261027`; PR #22 **DRAFT**, sem merge ou publicação.
- Zero ordens Paper externas, zero ordens Live, zero credenciais de corretora enviadas, zero contas Alpaca cadastradas; nenhuma cobrança.

## Implementação em branch
1. `paper-safety-gate-r80.mjs`: bloqueio fail-closed por titular, conexão, consentimento, kill switch, expiração do risco, teto financeiro, confirmação recente e ambiente PAPER preview apenas.
2. `paper-safety-store-r80.mjs`: RPCs de leitura e pausa restritas a service_role; sem segredo no navegador.
3. `paper-permit-issuer-r80.mjs`: emissor Ed25519 PRIVATE-only, `JENIOS_R80_PRIVATE_ISSUER_ENABLED` explicitamente exigido, confirmação server-side do Supabase Platform Auth, conta PAPER ativa vinculada ao titular e autorização explícita daquela ordem. Exige limite de risco persistido e grava autorização R79 antes de devolver a assinatura. Nenhuma chave de emissão foi provisionada.
4. `paper-worker-boundary-r80.mjs`: checagem do estado durável antes do R78/R79 e rechecagem após claim e antes de POST ao provedor. Não altera o adaptador homologado R77.
5. `paper-worker-recovery-r80.mjs`: recuperação somente leitura de recibos e ordens UNKNOWN/SUBMITTING/ACK/PARTIAL com estado PAUSED preservado; nunca retransmite ordens.
6. Testes `platformRobotR80*.test.mjs`, regressões B152/R77/R78/R79 e CI consolidada.

## Migração verificada no Supabase
- Versão instalada `20261027134227` / `jenios_robot_r80_private_paper_safety`.
- Arquivo GitHub: `supabase/migrations/20261027134227_jenios_robot_r80_private_paper_safety.sql`, mesmo conteúdo de `supabase/review/jenios_r80_paper_safety.sql`.
- Nova tabela de segurança começa sem registros, default PAUSED, kill=true, Paper consent=false e Live=false.
- RLS habilitada; sem SELECT para anon/authenticated, SELECT apenas service_role.
- RPC `jenios_r80_engage_paper_kill` revoga approvals pendentes, mas NÃO cancela ordens aceitas nem encerra posições.
- RPC R79 claim agora aguarda lock da linha de segurança ACTIVE e risco válido; claim e kill concorrentes serializam no Postgres.
- Verificação pós-migração: tabela de segurança zero linhas, tabela de approvals R79 zero linhas e zero conexões Alpaca Paper.
- RPC R79 claim, R80 read e R80 kill: EXECUTE permitido somente para service_role.

## Testes e limites atuais
- CI #40514160126: SUCCESS no SHA `b506df95d71eb00f99b342d82b4ca14f3a51c92e` (testes específicos, regressão global e build).
- SQL posterior e correções do workflow exigem **nova CI no SHA final** antes de integrar.
- Nenhum emissor está implantado em host privado; nenhuma chave privada Ed25519 está configurada. Nenhuma rota pública de emissão ou envio de ordens foi criada.
- R74 Edge runtime permanece sintético. Não há worker executor R80 operacional acoplado ao host atual.
- Recuperação após reinício existe como módulo isolado e requer worker, cofre, ledger B152 persistente e conta real PAPER consentida para ser homologada.
- Não houve ensaio externo Alpaca Paper, execução Live ou teste de assinatura/distribuição iOS/Android nesta entrega.

## Pendências para fechar Etapa 1
Revisão independente do SQL de concorrência e segurança; ativação autorizada do fluxo de risco por titular; ligar o emissor e o R80 worker em host privado confiável, com credenciais de serviço protegidas e ledger durável; ensaios de pausa/restart/reconciliação ponta-a-ponta em ambiente Paper autorizado; CI final verde; checkpoint imutável e rollback verificados.

## Regras de rollback
Não apagar tabelas, consentimentos ou registros. Para rollback de código, manter PR draft e release R79 sem merge. Manter `JENIOS_REAL_EXECUTION_ENABLED=false`, flags privadas PAPER/issuer/recovery desativadas e PAY desativado. A migração no banco é aditiva mas endurece o claim R79, que permanece inerte sem linha de risco ACTIVE. Não declarar live ready.
