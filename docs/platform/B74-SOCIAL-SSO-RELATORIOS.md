# R45-B74 — Corrigir cadastro BankScore/Validador e entrada única no simulador
19/10/2026 · JENIOS somente · Sem tocar nos dados financeiros, laudos e motor de robôs.

## Bug comum dos dois relatórios
- `lib/reports/prelaunch-access.mjs` exige identidade verificada pelo Supabase Social e registro na tabela `public.profiles`.
- Auditoria SQL prévia: `authenticated` podia consultar `profiles`, porém o papel `service_role` do servidor não tinha autorização nem para a coluna `id`.
- Uma migração exclusivamente no Supabase Social de produção `igayfjorjmucthlfoasf` foi aplicada: `GRANT SELECT (id) ON TABLE public.profiles TO service_role;`.
- O resultado foi confirmado por `has_column_privilege`, mantendo indisponíveis as demais colunas para esse papel, e mantendo `anon` sem SELECT.
- Caso seja necessário reverter especificamente esse grant: `REVOKE SELECT (id) ON TABLE public.profiles FROM service_role;`.
- O acesso continua exigindo token do usuário autenticado e perfil correspondente; nenhum visitante anônimo recebe laudo completo.
- A mesma verificação é utilizada por BankScore e Validador. Regressão do código das respectivas APIs ainda obrigatória antes da promoção.

## Sala de Controle sem segundo login
- Conta Social autenticada e perfil confirmado permitem abrir a Sala de Controle e o simulador fictício.
- A identidade é conferida remotamente no Supabase e novamente após a checagem do perfil; jamais confiar somente em localStorage.
- O diário/pausa/saldo usam chave por usuário `social_UUID`, mantendo isolamento de sessões.
- O Supabase dedicado da Platform permanece independente: login Social não é token Platform, não concede privilégios administrativos, assinatura, diagnóstico verificado nem negociação real.
- O login original da Platform continua funcional quando a Social não está autenticada.
- `Dashboard`, `Dashboard-logado` e `Mesa` compartilham o mesmo dono de simulação sem misturar dados da Social com o banco privado.

## Preservação
- Produção B73: commit `688473809ca752f8da4c9893bf2dccdcdd46a6c9`, deployment `dpl_J8ug5fBrxsdE8RSqeYTQ1R9SYVfp`.
- Backup de recuperação: `backup/jenios-b73-pre-sso-bankscore-token-fix-20261019`.
- Branch de correção isolada: `fix/jenios-b74-social-sso-reports-20261019`.
- Não promover sem CI, build e verificação de APIs, incluindo o cliente Social.

Limitação: a confirmação positiva de abrir/baixar com usuário real precisa de teste autenticado; nenhum token nem senha de usuário foi coletado.