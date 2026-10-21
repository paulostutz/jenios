# JENIOS B299-QA — Stage 2: readiness de Auth, PAY e corretoras (sem ações externas)
Data: 21/10/2026 — branch privada de homologação comercial.

## Bases e garantias
- Repositório `paulostutz/jenios`; última base integrada B298-R2 `8b6d47d815708e9c038c585c62ec05ae333ccd07` (CI 39686521520 SUCCESS).
- Pré-backup imutável: `backup/jenios-b299qa-pre-stage2-b298r2-20261021`.
- Branch privada exclusiva `fix/jenios-b299qa-stage2-auth-pay-readiness-20261021`. Regras `vercel.json` bloqueiam deploy automático de B298 e B299QA.
- Preserva produção B177-R3 `caaffece04649a6dc1ca6c8012d7502887771529`.
- Sem alteração nos módulos operacionais, núcleo proprietário, tabelas QA, PAY, migrações, Vercel secrets ou conexões reais.

## Diagnóstico somente leitura realizado
- Supabase Social QA `rebzztxlzofxpfwjvbee` e Platform QA `xaicvhagftzjkqphnbgx` ACTIVE_HEALTHY.
- Migração `jenios_b291qa_university_monthly_inactive_20261021` já está no histórico, versão 20261021194754; não reaplicar.
- Em ambos os projetos, Auth possui zero contas na inspeção inicial. Social QA: zero pedidos, pagamentos e faturas.
- Produtos inativos: Nacional R$ 99,90; Global Crypto R$ 149,90; Internacional Pro R$ 199,90; Universidade R$ 49,90.
- RLS dos objetos financeiros está ativa. Políticas SELECT limitam orders/subscriptions ao titular, payments ao pedido do titular, products a ativos; tabelas privadas não concedem SELECT a público anon.
- Tabelas administrativas da Platform recusam SELECT a anon/authenticated e dão SELECT apenas a service_role.
- Avisos de segurança `SECURITY DEFINER` na Social ainda merecem revisão funcional antes de modificar privilégios; não foram alterados.
- Variáveis de branch Preview B291 incluem segredos financeiros de QA, mas o inventário da branch não mostra `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`. Listagens globais podem ser paginadas: não concluir ausência absoluta até inspeção de escopo no painel.
- Sem comprovação de conectividade PAY no hostname real do Preview. Tentativas externas nesta sessão não conseguiram acesso DNS à URL, e os testes HTTP registrados na CI B293 são localhost.

## Entregas deste bloco
- `lib/platform/qa/b299-stage2-readiness.mjs` valida escopos Social/Platform QA, prova financeira estrita e flags desligadas. Não recebe nem exibe valores de secrets no relatório. Exige presença (não valida autenticidade) das chaves QA para preparar E2E privado.
- `inspectB299QaCatalog` valida preços e produtos inativos em resultados previamente verificados via consulta read-only no Supabase. Essa função não atesta, sozinha, a resposta hospedada do endpoint PAY.
- `inspectB299QaBrokerGuides` separa dois adaptadores de leitura demo não autenticados (Binance Testnet e Alpaca Paper) dos dez guias que ainda dependem de fornecedores/terminais. Não promove execução.
- `scripts/platform/b299-qa-stage2-preflight.mjs` possui somente `--fixture` (sem network) e `--audit` (inspeção da configuração local por nomes; sem leitura externa). Nenhum modo cria contas, assinaturas, pedidos, ordens ou utiliza IA paga.
- Reutilização do **CP69 autenticado**, já implementado em `scripts/platform/cp69-authenticated-e2e.mjs`. Exige servidor localhost:3129, credenciais somente da Platform QA, criação de contas fictícias via Auth Admin, testes 401/403, leitura segregada e deleção em finally. **Não executado nesta CI e nem nesta etapa sem credenciais/autorizações necessárias**. Esse script pode ter escrita transitória em QA; só executá-lo em runtime privado com aprovação específica, nunca usando tokens de produção.
- Testes novos adversariais e CI isolada sem deploy.

## Pendências honestas e próximo gate
1. Conferir no Vercel o secret `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` associado **somente** ao Preview correto, sem revelar seu valor.
2. Provisionar credenciais QA apropriadas de forma segura e realizar CP69 com autorização, dupla identidade fictícia e limpeza certificada. Não inserir diretamente em `auth.users`.
3. Autenticação Social E2E real e continuidade de sessão com duas contas QA.
4. GET ao endpoint financeiro do Preview e comprovação de dados persistidos, não só fallback, sem cobranças.
5. Revisão das quatro funções de `SECURITY DEFINER`, perfis e RLS preservando serviços legítimos.
6. Conexão com corretora somente leitura mediante consentimento do proprietário e credenciais específicas; registrar revogação e fonte, sem ordens.
7. Banco Inter, Pix mTLS, IA generativa paga e resultados observados continuam dependentes de autorização/segredos e têm status NO-GO.

A homologação externa, uso de dinheiro real/Paper externo, alegações comerciais de resultado e promoção a produção permanecem proibidos. CI verde neste bloco atesta somente configuração de QA simulada, testes estáticos e build.
