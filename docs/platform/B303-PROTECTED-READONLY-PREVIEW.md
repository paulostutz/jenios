# JENIOS Platform B303 — Preview protegido e pré-homologação GET

Base: B301, commit `b1956cab6aa4e9bcac26a9f57688e279e3b9c691`, CI 39693360965 SUCCESS. Diagnóstico B302 da Biblioteca `/JENIOS/Checkpoints/B302/`.

## Escopo autorizado e limites

**Somente o projeto Vercel** `jenios-platform-homologacao` (`prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9`), no ambiente **Preview** e branch `fix/jenios-b303-protected-readonly-preview-20261021`. O projeto foi encontrado previamente com `ssoProtection.deploymentType=all`, o que exige login Vercel. Confirmar novamente após criar o deployment, sem criar compartilhamentos que dispensem autenticação. Não apontar domínios de produção, não promover, nem alterar outras aplicações. Este bloco não cria contas ou identidades fictícias.

- `lib/release/environment-scope.mjs`: adiciona UMA exceção específica de Preview S05, exigindo ambos os bancos QA (Social stage apenas para isolamento legado, Platform QA dedicada), chaves publicáveis configuradas, projeto QA quando identificável, modo somente leitura, controles de execução, Paper, pagamentos, cadastro e conectores demonstrativos DESLIGADOS. As verificações de produção e de branches anteriores permanecem inalteradas.
- `lib/platform/connections/b303-private-preview-readiness.mjs`: preflight somente leitura, sem requisição de rede ou publicação de segredos. As flags mostram **presença de configuração**, jamais validade de autenticação real ou resultado de negociação. Sempre `NO_GO_EXTERNAL_AUTHORIZATION_AND_BROKER_READ_REQUIRED`.
- `app/api/platform/homologacao/b303-broker-preflight/route.js`: GET exclusivo de Preview, com Bearer Supabase do **banco dedicado da Platform** e permissão `platform.admin` via os mecanismos existentes. Status sanitizado; sem retorno de IDs/credenciais, sem token e sem POST. Enquanto não houver service-role do banco QA e conta administrativa autorizada, retorna indisponibilidade ou autorização negada, nunca sucesso fingido.
- `tests/platformB303ProtectedPreview.test.mjs`: somente fixtures locais; casos negativos para branch/projeto, banco errado, execução/ordens, pagamentos/cadastro prematuros, método, autorização e isolamento. Mantidos todos os testes anteriores.
- `vercel.json`: desliga deployment automático desta branch em **todos** os projetos ligados ao mesmo GitHub, para permitir publicação Git/CI sem criar previews indevidos. A criação manual é feita EXCLUSIVAMENTE no projeto QA após CI aprovada.

## Ambiente protegido — configuração mínima

Variáveis de Preview *exclusivas desta branch*; não preencher por reprodução de segredos de produção:

- `NEXT_PUBLIC_PLATFORM_SUPABASE_URL`, `PLATFORM_SUPABASE_URL`: URL do Supabase Platform QA `xaicvhagftzjkqphnbgx`.
- `NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY`: chave **publicável**, nunca service role.
- `NEXT_PUBLIC_SUPABASE_URL`, `SOCIAL_SUPABASE_URL`: URL do Supabase Social QA `rebzztxlzofxpfwjvbee` exigida pela política S05; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave **publicável**.
- `JENIOS_QA_CANDIDATE_ENABLED=true`, `JENIOS_QA_ADMIN_READONLY_ENABLED=true`, `JENIOS_B303_READONLY_ENABLED=true`.
- `NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED=false`, `NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI=false`, `JENIOS_DEMO_CONNECTORS_ENABLED=false`, `JENIOS_PAY_PAYMENTS_ENABLED=false`.
- `JENIOS_REAL_EXECUTION_ENABLED=false`, `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED=false`, `JENIOS_PRIVATE_PAPER_EXECUTOR=false`.

**Não criar service role ou segredo de cofre em arquivos.** `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` e `JENIOS_DEMO_VAULT_KEY_B64` continuam pendentes de provisionamento no painel/cofre seguro sob autorização específica antes de liberar formulário de credenciais. Nunca ativar chaves de negociação Live nem inserir segredos em GitHub, Library, chat ou logs. A ausência de contas na Platform QA (0 usuários, 0 vínculos), verificada no B302, impede GET autenticado no fornecedor. Um usuário de homologação deverá ser autorizado com identidade verdadeira, sem inventar e-mail ou credenciais.

## Aceite

1. CI remota da branch com testes/regressão/build verdes, artefatos exclusivamente públicos não proprietários.
2. SSO do projeto QA preservado; deployment explicitamente `target=preview`, dentro do projeto QA; nenhum deployment para os outros projetos por esta branch; produção `jenios-ecossistem` intacta.
3. Página informativa `/platform/homologacao` acessível **somente após autenticação da Vercel**, sem dados de conta; `/integracoes` exibe apenas guias, sem formulário de captura de chaves até o gate real.
4. Rota B303 retorna 401/403/503 ou `NOT_AVAILABLE` conforme autorização/configuração, jamais inventa resultados da corretora.
5. Após inserir segredos por painel seguro e cadastrar usuário voluntário, nova autorização específica será necessária para ativar consultas GET oficiais de Alpaca Paper/Binance Spot Testnet, com revogação e evidências externas independentes.

## Decisão

**B303 pode certificar a implantação privada informacional e o preflight interno**, nunca a ligação externa. Sem conta/credenciais autorizadas, permanecer `EXTERNAL_READONLY_ACCOUNT_NOT_AVAILABLE`, resultados do Lossômetro `null` para resultados efetivos, nenhuma ordem real/Paper, pagamento, usuário criado automaticamente, mudança em CHEFE/LETTER ou núcleo proprietário.