# JENIOS Platform — CP69 | caminho mais curto para homologação autenticada

**Escopo:** JENIOS Platform exclusivamente. Supabase de homologação: `xaicvhagftzjkqphnbgx`.
Nunca apontar para `jenios-social`, `jenios-social-homologacao` ou `chefe`.

## Já provisionado
- Supabase Pro JENIOS, projeto `jenios-platform-homologacao` em `sa-east-1`.
- Migrações exclusivamente nele: diagnóstico, eventos de risco e permissões/auditoria da Platform.
- Testes locais e sintéticos em branch isolada (não publicação).

## Passo protegido para executar QA autenticada automaticamente
A ferramenta não fornece a chave secreta de servidor da nova instância; **nunca escreva a chave num chat ou no código do GitHub**.

1. Em GitHub / `paulostutz/jenios`, abra **Settings > Environments**, crie `jenios-platform-auth-qa` e restrinja o ambiente à branch `fix/jenios-platform-cp69-lancamento-auth-20261019`. Configure um revisor obrigatório, se a opção estiver disponível.
2. No ambiente protegido, adicione **Environment secrets** `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` (secreta, chave da instância exclusiva) e `PLATFORM_QA_PUBLISHABLE_KEY` (chave publicável dessa mesma instância). Nunca usar tokens da Social ou PAY.
3. Em **Settings > Secrets and variables > Actions > Variables** (repo), cadastre `PLATFORM_CP69_REMOTE_QA_ENABLED` com valor `true` quando estiver pronto para acionar a homologação.
4. Na branch de homologação, um push autorizado disparará CI isolada e o job `authenticated-qa`. O job sobe Next.js *somente no runner*, cria duas contas fictícias com endereços reservados `@example.com`, valida login, laudo por conta, matriz admin, RLS, ausência de operações, e deleta as duas contas em `finally`. Se qualquer exclusão falhar, o job falha e exige inspeção manual.
5. Confira o GitHub Actions completo e certifique-se de que **o job `authenticated-qa` terminou em sucesso, não `skipped`**. Somente isso pode comprovar a parte autenticada do aceite R45 (sem comprovar negociação real).

Se o ambiente ou os segredos não forem configurados, o workflow **não executará** a QA autenticada: o bloco offline poderá ficar verde sem demonstrar login real. Não atribuir 70% nesse caso.

## Prévia privada na Vercel (etapa de publicação)
Antes do lançamento, preferir projeto Vercel separado e protegido com domínio de homologação, ligado à branch. Na Vercel, cadastrar por ambiente:
- `NEXT_PUBLIC_PLATFORM_SUPABASE_URL`: URL do Supabase exclusivo (pública).
- `NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY`: chave **publicável** do projeto exclusivo.
- `PLATFORM_SUPABASE_URL`: mesma URL do projeto exclusivo, variável servidor.
- `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`: **secreta** do projeto exclusivo, apenas servidor (nunca com `NEXT_PUBLIC_`).
- `NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED`: `false` até a etapa de liberação controlada de cadastros.
- `PLATFORM_ADMIN_USER_IDS`: IDs de usuários exclusivos da Platform somente após aprovação administrativa.

**Configurações Supabase Auth:** após definir a URL da prévia, permitir apenas redirects confiáveis `/platform/entrar` e `/platform/redefinir`. Configurar SMTP dedicado antes de abertura pública; QA cria usuários confirmados sem disparar e-mail.

A criação de uma **nova** instância Vercel e sua eventual computação podem gerar cobranças. Confirmar permissões, preço e proteção antes de criá-la.

## Critérios de aceite por etapa
- **Pré-lançamento em simulação:** login, cadastro controlado, recuperação de senha, Dashboard, Mesa, diário fictício, diagnóstico autenticado, Admin segregado e proteção de sessão; QA real e mobile, navegação, segurança e revisão jurídica de informações ao consumidor.
- **Assinaturas:** vínculo entre identidade da Platform e conta pagadora JENIOS PAY homologado; preços e webhooks testados com transações fictícias/autorizadas; sem assumir que usuário da Social é assinante da Platform.
- **Dinheiro real:** NÃO liberar até autenticação/consentimento de corretora, licenças de dados, piloto prospectivo, risco/segurança, compliance e revisão jurídica. Os robôs originais estão preservados para testes na última fase.

## Rollback
Voltar à branch `fix/jenios-platform-cp68-integracao-areas-20261019` e seu backup da Biblioteca.
Nenhuma migração extra é necessária neste CP69. Não há ordem real, e-mail a terceiros ou pagamento.
