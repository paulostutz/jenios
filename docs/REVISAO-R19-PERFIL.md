# R19 — Editor de perfil e diagnóstico da configuração

Paulo confirmou em 15/10/2026 a entrega do e-mail de recuperação (spam), redefinição e login com a nova senha. Fluxo R18 homologado pelo usuário.

A URL pública do Supabase foi adicionada pelo usuário ao Preview da branch codex/social-r16-teste e republicada em https://jenios-ecossistem-bsznavwim-jenios.vercel.app. A rota /redefinir-senha desse endereço foi autorizada no Supabase.

## Correções
- Editor mantém rascunho separado do perfil publicado; erro não altera a identidade exibida.
- Avatar padrão não é enviado como upload SVG. Permite gravar o perfil sem foto.
- Nome, identificador, bio e cargo são gravados em profiles com RLS do próprio usuário; resposta da gravação é exigida para confirmar sucesso.
- Cargo adicionado por migração 20261015192414_social_profile_cargo; carregamento inclui cargo.
- Falha preserva o formulário; envio duplicado bloqueado durante gravação; upload respeita a conta que iniciou a operação.
- Erro explícito de API key inválida retorna indisponibilidade do serviço, sem dizer incorretamente que a sessão do usuário expirou.

## Evidência de ambiente
Em 15/10/2026 19:18 UTC, autenticação do usuário /auth/v1/user respondeu 200 no navegador, seguida de chamada node com 401. Às 19:20 UTC, consulta node ao BankScore respondeu 401 no Supabase e o endpoint público da prévia retornou 503 codigo CONSULTA. O perfil do usuário ainda não existia; a interface usava os oito caracteres do UUID como identificador provisório. Não foi alterada diretamente a conta do usuário.

A credencial server-side usada pelo upload e BankScore precisa ser conferida no projeto Vercel jenios-ecossistem, Preview, branch codex/social-r16-teste: SUPABASE_SECRET_KEY do projeto Supabase igayfjorjmucthlfoasf. O conector Vercel segue sem acesso autorizado à equipe; nenhum segredo foi lido ou escrito por esta etapa.

## Validação
Teste de navegador com serviços simulados: rascunho isolado, identificador duplicado, gravação sem foto, cargo e handle após recarregar, falha de upload preservando formulário. Doze endpoints continuam 401 para visitante. Testes unitários distinguem chave inválida de sessão expirada/anônima. Build registrado em evidencias-r19. Upload real e BankScore permanecem bloqueados pela configuração de servidor. Hub MegaPulse e baleias ainda exigem fonte integrada; não foram declarados concluídos.

Revisão de segurança após migração: nenhuma política de profiles foi ampliada; permanecem INSERT/UPDATE do próprio usuário. Avisos preexistentes sobre rls_auto_enable e proteção de senhas vazadas continuam pendentes de revisão específica. Tabelas privadas sem políticas permanecem fechadas. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
