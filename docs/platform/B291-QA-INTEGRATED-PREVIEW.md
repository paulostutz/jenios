# JENIOS B291 — Preview integrado isolado, Universidade e segurança comercial

Data: 21/10/2026. Base B290 QA: c0dad20ad73005d55178054e2f9ea7ec0cc377e6, CI 39661721181 SUCCESS.

## Base homologada verificada
B289 aplicou somente em Social QA (rebzztxlzofxpfwjvbee) as tabelas PAY, R26 de progresso e os três planos Platform inativos. B290 adicionou um comprovante Pix E2E com acesso somente de servidor e validou vínculo bancário de assinaturas em leitura. Os dois Supabase QA possuem zero usuários Auth; não inserir dados em auth.users manualmente, não simular recibos reais.

## Bloco B291
- Aplica somente em Social QA a estrutura canônica B147 da Universidade (R$ 49,90), com produto deliberadamente INATIVO. O script possui verificação de banco isolado e de ausência de usuários, pedidos e pagamentos reais, índices e RLS server-only.
- Autoriza exclusivamente a branch fix/jenios-b291qa-integrated-preview-20261021 para Vercel Preview; exige Social QA rebzztxlzofxpfwjvbee e Platform QA xaicvhagftzjkqphnbgx.
- Exige JENIOS_QA_STRICT_SUBSCRIPTION_PROOF=true: estado active sem pedido pago e comprovante Inter não libera recursos Pro.
- Exige NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED=false, JENIOS_PAY_PROVIDER=disabled, JENIOS_PRO_GENERATION_ENABLED=false, JENIOS_QA_CANDIDATE_ENABLED=false, e todos os flags de cobrança/IA externa e execução desabilitados.
- Preserva Social, LP, Universidade, Gênios, BankScore, PAY, robôs e a versão B177-R3 em produção.

## Evidências e limites
A CI executa testes adversariais de QA, banco e permissões, regressões completas, build Next.js e navegador localhost. O Preview precisa ser verificado separadamente via Vercel em páginas públicas, rotas 401 e catálogo sem cobrança. Nenhuma transação real, produto ativo ou ordem deverá ser criada.
Os projetos QA possuem zero usuários Auth e nenhuma credencial real de Inter ou IA: os testes locais autenticados são sintéticos e não provam o fluxo completo de usuário com senha, sessão e assinatura paga. Criação de contas Auth de homologação exige um procedimento seguro, fora de SQL direto em auth.users; a entrada de credenciais bancárias e o custo de IA continuam reservados à autorização do proprietário.

## Critérios de release
Não publicar produção sem aceite explícito, comprovação de pedido e recibo bancário real, E2E autenticado, segurança e rollback. O estado B291 é candidato QA e não produto publicável. Planejar B292 como checklist final de consolidação e rollback.

## Build QA com testes legados separados
Em Preview B291, a verificação inicial de escopo exige a prova financeira estrita. O comando npm test executa primeiro os testes específicos B290/B291 com a prova estrita verdadeira; depois executa apenas os testes históricos sintéticos com uma cópia de variáveis em que somente JENIOS_QA_STRICT_SUBSCRIPTION_PROOF está falsa. Nenhuma variável global é modificada. A etapa seguinte de testes S05 e a compilação Next.js mantêm o ambiente QA original. Fora da branch B291 o runner executa a suíte geral sem qualquer alteração de ambiente. Esse procedimento evita transformar um teste legado com assinatura sintética em suposta evidência de pagamento bancário.
