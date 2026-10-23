# B305-R18 — Onboarding durável da Platform

Base consultada:
- R17 certificado `ceac4d64f15b970a2915c44fa466d93468a0ab3d`;
- CI R17 `39879158849` SUCCESS;
- Preview R17 READY;
- artefato R17 `12470225549`, digest `sha256:99d0e30277aee30c1f84e24c8cc535feba3052ad4456e3ddc4b34b3b73fb1fb3`.

Descoberta:
- o backend dedicado da Platform já persiste onboarding/diagnóstico em `jenios_platform_diagnostics`;
- `/diagnostico` já usa `submitAccountDiagnostic` e `observePlatformDiagnostic`;
- `/onboarding` era uma implementação antiga apenas local, sem persistência durável.

Alteração:
- `/onboarding` agora redireciona para `/diagnostico`;
- nenhuma tabela nova foi criada;
- nenhuma lógica de diagnóstico foi duplicada;
- e-mail de onboarding concluído continua sem trigger automático até existir uma ponte de identidade/delivery própria da Platform.

Separação de bancos preservada:
- Social/JENIOS PAY/e-mail financeiro: Supabase Social;
- diagnóstico/risco/auth privado da Platform: Supabase Platform dedicado.
