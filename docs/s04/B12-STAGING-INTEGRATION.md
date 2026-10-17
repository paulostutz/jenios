# JENIOS S04-B12 — integração isolada Supabase/Vercel

Data: 2026-10-17. Escopo: branch `jenios-s04-b12-staging-integracao-20261017`; **NÃO promover a produção**.

## Origem e destino
- Base do código: branch S04-B08, commit `1bae11c491857308f0bfd279e38974fcb95229d4`.
- Projeto Vercel existente: `jenios-ecossistem`, apenas um deployment `preview` da branch B12.
- Supabase exclusivo de testes: `rebzztxlzofxpfwjvbee`, na mesma organização, com base **separada**.
- Produção Supabase: `igayfjorjmucthlfoasf`, **intocada**.
- Pagamentos: bloqueados; nunca usar dados financeiros, dados reais de clientes ou o núcleo proprietário dos robôs.

## Dupla proteção
1. Variáveis branch-scoped `preview`: URL e chave publishable do Supabase de testes, para o cliente e para a busca de @.
2. Credenciais privilegiadas de Supabase, Banco Inter e JENIOS PAY explicitamente desabilitadas nessa branch. Teste grátis e processamento de vídeo otimizados desligados.
3. Middleware bloqueia todas as APIs com exceção de `GET /api/social/handles`, e páginas com exceção de `/login`, `/cadastro`, `/s04-laboratorio`. `GET /` e `GET /social` redirecionam à página de laboratório.
4. `scripts/check-s04-staging-build.mjs` interrompe o build quando detectar credenciais de produção, URL incorreta, ativação do trial ou `VERCEL_ENV` diferente de `preview`.
5. As rotas financeiras originais não são modificadas; estão simplesmente inacessíveis nessa prévia isolada.

## Verificações disponíveis
- No PostgreSQL de homologação: unicidade do @, criação de perfil pela trigger, regras RLS, fila de exclusão, auditoria e concessão única de 168 horas, com rollback dos usuários fictícios.
- Na aplicação de laboratório: abrir `/s04-laboratorio`, criar conta fictícia em `/cadastro`, entrar em `/login`, conferir `auth.getUser()` e leitura de `profiles` limitada ao usuário autenticado.
- **Não considerar automaticamente homologado** o E2E de login e e-mail: depende de teste HTTP/autenticação real, configurações permitidas de redirect do Supabase e verificação humana se o acesso por rede falhar.
- A prévia é temporária e deve ser desligada quando concluir a homologação para reduzir superfície pública.

## Fora do escopo
- Nenhuma alteração na `main`, `jenios.com.br`, supabase de produção, Docker ou serviços financeiros.
- Sem execução de dinheiro real, sem cobrança, sem envio de mensagens a pessoas reais.
- O teste grátis da Platform continuará desativado até provedor de identidade verificada, consentimentos, auditoria e testes externos.

## Remote HTTP smoke (S04-B13)
- A Vercel consultará `GET /auth/v1/health` e a RPC `social_handle_availability_v1` no Supabase de homologação.
- Verificará que anon não lê `jenios_s04_staging_guard_20261017`, o ledger de teste grátis nem perfis de usuários.
- A verificação é somente leitura, não cria contas, não usa CPF e não consome credenciais bancárias.
- O build **falhará** caso o serviço esteja indisponível, a função RPC incorreta ou uma tabela protegida exponha dados.
- O teste não substitui a autenticação real em um navegador nem a confirmação de e-mail.
