# JENIOS B291 — Candidato integrado de lançamento, SOMENTE Preview QA
**Base:** B290 `c0dad20ad73005d55178054e2f9ea7ec0cc377e6`, CI `39661721181` SUCCESS. **Produção original:** B177-R3, commit `caaffece04649a6dc1ca6c8012d7502887771529`, deployment `dpl_7omqt69GFwJRMEUp4QCyx5hXrciF`; não modificar.

## Blocos consolidados
**B289 (QA schema):** esquema canônico JENIOS PAY V1 e progresso R26 instalados **apenas no Supabase Social de homologação** `rebzztxlzofxpfwjvbee`. 3 produtos mensais cadastrados com preços R$99,90/R$149,90/R$199,90 e `active=false`. As 7 tabelas revisadas têm RLS ligado. Permissões diretas de gravação financeira de `anon` e `authenticated` bloqueadas. Banco de homologação tinha 0 usuários, 0 pedidos, 0 pagamentos, 0 assinaturas, 0 entitlements e 0 estados educacionais; dados de produção **não foram copiados**. CI `39660584637` SUCCESS.

**B290 (integridade de assinatura):** schema QA ganhou campo de identificador E2E único de Pix, sem criar nem autenticar uma cobrança. Módulo `verified-subscription-b290.mjs` atesta vínculo de usuário, produto, assinatura vigente, último pedido efetivamente pago e recibo confirmado de Inter Pix com txid e E2E consistentes. O servidor só aplica a verificação reforçada quando `JENIOS_QA_STRICT_SUBSCRIPTION_PROOF=true`. Não há conversão de assinatura simulada em plano real, nenhum webhook, dinheiro ou ordem. CI `39661721181` SUCCESS.

**B291 (Preview e release):** o gate S05 autoriza somente a branch `fix/jenios-b291qa-launch-candidate-20261021`, exclusivamente em Vercel Preview com Supabase Social QA `rebzztxlzofxpfwjvbee` e Supabase Platform QA `xaicvhagftzjkqphnbgx`. Exige strict QA proof `true`, signup Platform `false`, JENIOS_PAY_PROVIDER `disabled`, e TODOS os flags de IA paga, cobranças, execução real, executor Paper e conectores demonstrativos explicitamente `false`. Branches não autorizadas e qualquer promoção dessa branch à produção continuam bloqueadas.

## Testes de aceite interno
1. CI Node: 3 blocos de testes, guarda de alterações `b291-integrity`, regressão geral `npm run build` (inclui testes Social S05), build Next.js e zero chamadas externas pagas.
2. Chromium localhost: Gênio/Gênia e jornada comercial na Social/LP/Platform; páginas da Universidade e acesso visitante; UI responsiva nos tamanhos previamente homologados; desabilitação do Pix legada.
3. HTTP localhost: cadastro/login Social, login Platform, recuperação de senha, LP, Social, Universidade, checkout 200; API Gênio/Gênia pública 200; endpoints privados sem autenticação devolvem 401; catálogo mensal com `checkoutReady=false` e `paymentsEnabled=false`; solicitação cross-origin ao chat bloqueada.
4. Preview Vercel: verificar deployment `READY` na branch correta, sem alias de produção, rotas e endpoints conforme above. Conferir apenas chaves públicas de QA e não revelar service_role/segredos. Não testar serviços de dinheiro real e não forçar desativação das proteções.
5. Banco QA: garantir contagens financeiras nulas, produtos inativos, RLS, privilégio exclusivamente servidor e comprovante E2E único. Nenhum teste deve gravar recibos falsos na base.

## Critérios NÃO satisfeitos neste candidato
- Ainda não existem usuários Auth nos dois Supabase de QA; a jornada **autenticada real** não pode ser homologada até a criação de contas de teste por canal seguro. Simular sessão em Chromium é teste funcional, não login real.
- Banco Inter: Master ainda precisa inserir Client ID, Client Secret e ZIP no Admin e autorizar teste mTLS. Envio e conciliação de cobranças, prova de settlement, ativação e renovação de assinatura real estão adiados a pedido do usuário.
- IA comercial generativa: desativada no Preview; credenciais e limite de gasto ainda não foram autorizados/configurados. Fallback guiado gratuito funciona.
- Provas prospectivas e risco dos robôs permanecem em trilha independente; sem habilitar execução real.
- Antes de lançamento público será obrigatório aceite Auth real, gateway bancário, tratamentos de webhook e idempotência, políticas de cancelamento e aprovação explícita de publicação.

## Continuidade/rollback
Sem alteração no domínio `jenios.com.br` nem no deployment B177-R3. Para rollback futuro, usar apenas o deployment production-ready `dpl_7omqt69GFwJRMEUp4QCyx5hXrciF` após verificar projeto, domínio e autorização; **não executar rollback agora**.
Crie checkpoint e backup da branch após CI, e salve evidências em `/JENIOS/Checkpoints/B289-B291`. Não mesclar código de pesquisa paralelo dos robôs sem revisão.
**Esta versão candidata não autoriza o lançamento comercial nem execução de ordens.**

## Compatibilidade dos testes de aprendizagem em Preview QA
O modo de verificação financeira estrita é passado explicitamente pelos serviços de aprendizagem, mensalidade da Universidade e Gênios Pro por meio do `env` recebido do servidor. Testes antigos com assinaturas sintéticas agora passam explicitamente `JENIOS_QA_STRICT_SUBSCRIPTION_PROOF=false` **apenas dentro do fixture de teste**, sem suprimir o gate do runtime Preview, que continua exigindo `true`. Nunca alterar a configuração Preview para contornar testes de pagamentos fictícios.
