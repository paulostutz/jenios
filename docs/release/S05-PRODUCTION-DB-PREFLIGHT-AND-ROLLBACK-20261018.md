# S05 — Garantia da migração aditiva em produção (18/10/2026)

Escopo explícito: Supabase de produção `igayfjorjmucthlfoasf` para JENIOS Social. Não envolve pagamentos, BankScore, dados financeiros, permissões administrativas, B52 ou trial.

## Pré-execução (executada de forma READ-ONLY)
- `public.profiles`: 2 perfis; `auth.users`: 4 usuários existentes; nenhuma colisão de handles canônicos; nenhum trigger adicional em `auth.users`.
- `public.profiles` possui `id`, `handle`, `display_name`, RLS ativado e três políticas: `profiles_insert_self`, `profiles_read`, `profiles_update_self`.
- `social_handle_availability_v1` e `social_account_deletion_requests` **não existiam** antes deste bloco.
- Advisors anteriores: não há aviso de segurança CRITICAL relacionado às tabelas alteradas; advertência preexistente sobre Auth leaked-password protection.
- SQL revisado: `supabase/release-review/20261018_s05_social_identity_deletion_PRODUCTION_REVIEW_ONLY.sql` (blob `478bd366c3769880afe1cfb983035184d99e2763`).
- **Dry-run** na produção: SQL executado entre BEGIN e ROLLBACK, sem persistir tabelas/funções; confirmed handles_not_committed=true, deletion_queue_not_committed=true.

## Mudanças permitidas para fechamento da release
1. Índice único canônico não destrutivo no campo `handle`.
2. Trigger de normalização em alterações futuras de `handle`; mantém perfis atuais intactos.
3. Trigger `social_signup_profile_v1` apenas para cadastros opt-in `registration_source=social`, sem alterar provedores legados.
4. RPC de disponibilidade do @ com quatro sugestões.
5. Fila para solicitação, cancelamento e reabertura de exclusão (nunca exclusão de identidade automática), com RLS por usuário e autenticação recente.

## Plano de rollback para aplicação web
Rollback imediato da plataforma: reassociar ao deployment S02 `dpl_7vDVvGwfT6HKYf8n37EoBk9ccf24` via Vercel. O esquema aditivo pode permanecer presente sem impactar S02. Nunca apagar a fila de solicitações ou outras tabelas contendo dados reais para reverter interface.

Se houver impacto nos cadastros novos, primeiro desabilitar exclusivamente o trigger `social_signup_profile_v1` após diagnóstico, sem excluir perfis ou usuários. Restaurar o trigger apenas depois de corrigir a condição.

## Critérios após DDL
Verificar existência de função, índices, triggers, fila, RLS e grants, com contagem de usuários/perfis inalterada e nenhuma mudança de dados históricos. Inspecionar advisories. A migração de banco não certifica o deploy nem valida novas sessões HTTP.
