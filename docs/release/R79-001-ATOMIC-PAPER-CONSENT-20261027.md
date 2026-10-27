# JENIOS R79.001 — Claim atômico de autorização Paper e revogação

Registro 27/10/2026. Base exata: release R78 b8f246ec007e11074a78ba03820040a105bb9c07. Escopo exclusivo JENIOS Platform Supabase xaicvhagftzjkqphnbgx; não interfere em Social, CHEFE ou LETTER.

## Diagnóstico, reaproveitamento e entrega
B152 implementou reserva de risco durável SQLite; B166 GET da API oficial; B169 vínculo seguro de conta; R77 transporte Alpaca PAPER de um único POST; R78 verificação Ed25519 e leitura do registro de aprovação. R74 mantém motor privado em ciclos sintéticos. Nenhum desses componentes deve ser reconstruído.

A R78 anterior apenas executava findApprovedById, de modo que dois workers poderiam enxergar APPROVED simultaneamente. R79 troca o check por transição atômica única APPROVED -> CLAIMED **antes** de delegar qualquer execução Paper.

Arquivos R79:
- supabase/migrations/20261027121345_jenios_robot_r79_atomic_paper_approval.sql: tabela Paper de aprovação por usuário, conexão e ID de ordem, com unicidade do pedido, janela curta de cinco minutos, RLS, privilégio de tabela somente service_role. Não insere contas nem aprovações.
- RPC jenios_r79_claim_paper_approval: invoker com search_path vazio, grant service_role somente. UPDATE atômico usando relógio do banco, Owner + connection + digest da assinatura Ed25519 verificada no worker, não-revogado/não-consumido e confirmação de associação ativa à conta Paper do titular. Um único resultado possível entre dois workers concorrentes.
- RPC jenios_r79_revoke_paper_approval: revoga autorização apenas se ainda APPROVED; não cancela posições ou ordens externas.
- lib/platform/connections/paper-approval-store-r79.mjs: adaptador server-only, valida parâmetros e recibo do banco, não expõe credenciais nem rotas HTTP.
- lib/platform/connections/paper-signed-authorization-r78.mjs: agora requer claimApprovedForExecution e status CLAIMED, usado uma vez, antes de chamar R77. A assinatura Ed25519, modo, titular, conta, notional e validade continuam obrigatórios.
- Tests R78/R79: simulações de assinatura, corrida, atomicidade, expiração, falha do banco e malformação de recibo; testes estáticos do SQL e da separação de permissões.
- Manifest R79: hashes SHA Git e preservação de G49/G48/M02/R75-R78; CI sem chaves verdadeiras e sem rede da corretora.

## Não afirmar execução homologada
Mesmo com teste Node aprovado, o comportamento de atomicidade requer aplicação e confirmação SQL no Supabase exclusivo, controle de sessão por emissor Ed25519 e revisão independente. O emissor confiável, o fluxo de consentimento humano e a conexão efetiva da conta ainda não estão ativos. Não cadastrar autorização sintética como real nem acionar corretora. R78/R77 continuam impedidos de operar sem todas as flags privadas e conta aprovada.

A migração é aditiva e não destrutiva. Sem autorização Paper externa, sem trade Live, sem dados financeiros de terceiros, sem saques, sem pagamentos e sem chamadas à corretora nos testes. Continuam pendentes: kill switch por conta, reprocessamento seguro após reinício do worker privado, conexão Paper voluntária com prova oficial e TestFlight/Google Play assinados (M02 unsigned).

## Critério de aceite e rollback
CI de source hash, testes privados focados, 94 Social e compilação Next. Conferir em banco RLS, grants (anon/authenticated proibidos), RPC service-only, tabela vazia, contagem de ordens não alterada e claims inexistentes com zero resultados. Não executar operação financeira.

Código de rollback: R78 b8f246ec007e11074a78ba03820040a105bb9c07. A migração R79 não deve ser revertida apagando tabela ou consentimento. Simplesmente manter executor desligado. Registrar cada SHA, teste e backup antes de integrar.
