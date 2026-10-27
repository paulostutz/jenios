# JENIOS — R83.001 · Cofre privado LIVE, leitura oficial e revogação — 27/10/2026

## Fonte preservada
- Repositório exclusivo `paulostutz/jenios`.
- Branch de desenvolvimento: `fix/jenios-r80-private-paper-safety-20261027`, PR **#22 DRAFT**.
- Produção preservada em `release/jenios-genios-g44-20261024`, SHA `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` (R79).
- R74 original (duas Edge Functions sintéticas), R75–R82, JENIOS Social, PAY, aplicativo M02, CHEFE e LETTER não modificados.
- Nenhum endpoint de ordem Live, flag de negociação real, integração financeira ou cobrança foi ativado.

## O que a R83 implementou
1. `lib/platform/connections/alpaca-live-vault-r83.mjs`: cofre AES-256-GCM com nonce aleatório, tag de autenticação, AAD vinculado a titular da Platform, UUID da conexão, fornecedor `alpaca`, ambiente `live`, tipo de autorização e ID da chave de criptografia. Chaves Demo/Paper, hash de conta Live e chave de cofre Live devem ser distintos. Sem logs de segredos ou rota HTTP.
2. `supabase/migrations/20261027151211_jenios_robot_r83_private_live_vault.sql`: banco Platform exclusivo `xaicvhagftzjkqphnbgx`, tabela `jenios_robot_live_connections_r83` com acesso direto somente service_role, RLS habilitada, estado inicial `STAGED` sem identidade verificada, token armazenado **apenas cifrado**, identidade HMAC somente após GET oficial. RPCs `jenios_r83_mark_live_read_verified`, `jenios_r83_note_live_read`, `jenios_r83_revoke_live_connection` restritas ao serviço; CAS por revisão e revogação que apaga o envelope local.
3. `lib/platform/connections/alpaca-live-store-r83.mjs`: adaptador privado com escopo obrigatório de usuário/conexão, gravação selada, leitura exclusiva no serviço, confirmação de GET com controle de concorrência e revogação. Não retorna segredos ao cliente.
4. `lib/platform/connections/alpaca-live-readonly-r82.mjs` ampliado para autenticação GET por API key ou OAuth bearer, com origem fixa `https://api.alpaca.markets`. Nova sondagem de conta em estado `STAGED` devolve somente HMAC de identidade, nunca ID bancário bruto. R82 continua sem POST/DELETE/ordens.
5. `lib/platform/connections/alpaca-live-private-worker-r83.mjs`: fluxo privado de `stage`, `verify`, `inspect` e `revoke`, exigindo identidade server-side Supabase Auth Platform, consentimento específico de leitura LIVE e autorização separada da integração de terceiro. A revogação não exige conectividade da Alpaca e deixa claro que credenciais OAuth/API ainda precisam ser revogadas na corretora.
6. Testes `tests/platformRobotR83LiveVault.test.mjs`, `platformRobotR83VaultStore.test.mjs`, `platformRobotR83PrivateWorker.test.mjs` e testes R82 expandidos. Testam criptografia, troca de titular, adulteração, indisponibilidade, revogação concorrente, OAuth GET-only, conta substituída, ausência de autorização de terceiro, nenhum order POST e preservação de R77–R81.

## Migração R83 — evidência
- A migração `jenios_robot_r83_private_live_vault`, versão **`20261027151211`**, foi aplicada com sucesso exclusivamente à Platform JENIOS. SQL idêntico em `supabase/review/jenios_r83_live_private_vault.sql` e `supabase/migrations/20261027151211_jenios_robot_r83_private_live_vault.sql`.
- Consultas de auditoria: RLS **true**; anon e authenticated **sem SELECT**. As três RPCs R83 com EXECUTE **false** para anon/authenticated e **true** somente para service_role.
- Contagem inicial da tabela LIVE: **0**. Nenhuma chave real, autorização ou ordem inserida pela migração.
- Workflow `.github/workflows/jenios-r80-private-paper-safety.yml` inclui R83 na regressão consolidada, confere a fonte exata das migrações R80/R81/R83 e salva ZIP não secreto + SHA256 + checkpoint no GitHub Actions.
- CI #40528194014: SUCCESS antes de arquivar a migração. **Exigir nova CI SUCCESS no SHA final** deste checkpoint, não confundir sucesso antigo com a revisão final.

## Gates que permanecem bloqueados
- Sem aprovação efetiva e credenciais de integração Alpaca OAuth para terceiros, o flag `JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED` deve permanecer `false`. NÃO solicitar API keys ou tokens no chat; o futuro usuário só autoriza via aplicativo/fluxo seguro.
- O cofre e o leitor privados também exigem opt-in explícito via `JENIOS_R83_PRIVATE_NODE_WORKER`, `JENIOS_R83_LIVE_VAULT_ENABLED`, `JENIOS_R82_PRIVATE_NODE_WORKER`, `JENIOS_R82_ALPACA_LIVE_READ_ENABLED`, e continuam bloqueados quando `JENIOS_REAL_EXECUTION_ENABLED` não está `false` ou ambiente é produção web.
- O núcleo R74 continua sintético. Esta R83 **não foi implantada como worker operacional** e NÃO prova autenticação real com uma conta Alpaca Live ou Paper; testes de HTTP usam fixtures sintéticas e a CI não faz GET real contra contas de terceiros.
- Somente GET/diagnóstico; **zero** ordens Paper externas e Live enviadas, sem custódia, sem saques, sem pagamentos e sem mudança nas lojas iOS/Android.
- Falta homologação do aplicativo de terceiros com a Alpaca, cofre/identidade em host privado aprovado, uma conta voluntária Paper com recibos oficiais, controles completos de risco e consentimento Live por conta/ativo, execução de ordens Live independente de R77, kill switch, reconciliação e revisão independente. Nenhum destes gates foi dado como concluído.

## Rollback
- Não mesclar PR #22 na release oficial sem todos os testes e aprovações correspondentes.
- Preservar `JENIOS_REAL_EXECUTION_ENABLED=false` e flags da R83 desabilitadas. Banco R83 é **aditivo**, sem linhas e sem acesso público. Não remover tabelas como rollback nem desproteger RLS.
- Continuar conforme issue GitHub #15 e checkpoints R79/R80/R81/R82. Arquivar SHA, CI e deploy exato somente quando realmente confirmados.
