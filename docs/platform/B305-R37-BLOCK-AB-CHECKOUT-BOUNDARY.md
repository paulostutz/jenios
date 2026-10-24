# B305-R37 — Continuidade A e revisão comercial B

Data: 24/10/2026. Base R36: `f6cad0fc9f0ae85aed6e5b28e85a9e2a146315fd`.
Backup antes da alteração: `backup/jenios-b305-r36-before-block-ab-20261024`.
Escopo: plataforma JENIOS, sem Work, robôs, CHEFE ou LETTER.

## Achados reproduzidos

O catálogo inferia prontidão apenas das credenciais do gateway. As duas rotas públicas de checkout não conferiam `JENIOS_PAY_PAYMENTS_ENABLED`. A interface da Platform exigia `subscriptionLifecycleReady`, mas a rota de contratação não tinha essa mesma trava. Cinco testes reproduziram essas divergências no código R36 usando dependências locais sem qualquer cobrança.

## Correções

- As rotas genéricas Social e Platform exigem `JENIOS_PAY_PAYMENTS_ENABLED === 'true'` antes de obter acesso ao banco ou chamar o serviço de contratação.
- A Platform exige também `JENIOS_PLATFORM_SUBSCRIPTION_LIFECYCLE_CERTIFIED === 'true'`. Esta é uma atestação operacional nova, desativada por padrão; não certifica por si só nenhuma implementação. Não foi ativada na Vercel.
- A exigência não pode ser substituída por credenciais presentes, produto ativo ou parâmetro enviado pelo cliente.
- O catálogo publica a mesma prontidão. Gateway inválido não faz desaparecer o catálogo válido do banco; falha do banco continua gerando apenas catálogo não contratável.
- Pix Inter continua indisponível para assinaturas Platform pelo adaptador genérico, como já era antes. Esta revisão não implementa renovação bancária.
- Os corpos de checkout são limitados a 8 KiB com o leitor existente, tipo JSON e estrutura válida. UTF-8 inválido, arrays e solicitações excessivas são rejeitados.
- Relatórios gratuitos de pré-lançamento permanecem fora da cobrança. Autenticação, titularidade, regras de visitante e validação de preço continuam nos componentes existentes.

## Testes

23 testes locais de regras, catálogo e corpos dos handlers HTTP passaram. Os handlers são exercitados com dependências locais injetadas; o build Next.js verifica suas importações reais. Os serviços comerciais existentes recebem também 11 cenários para execução na CI, com banco em memória e transporte falso: preço do catálogo, titularidade, escopo, produto inativo, idempotência, conservação de preço, pedido pago, encerrado, acesso pago e recurso vinculado.

O workflow mantém todos os gates de operação desligados, executa os cenários A/B explicitamente e inclui os arquivos R36/R37 e o TAP no artefato. A aprovação final deve ser conferida no run e no Preview do SHA exato; a existência deste documento não é aprovação de CI nem de produção.

## Aceite hospedado permanece pendente

O conector Vercel retornou `deployment_authentication_required` antes de alcançar a aplicação. Não havia CLI Vercel autenticada no ambiente local. A proteção não foi desativada; não foram criados tokens, usuários, comprovantes ou pagamentos para contornar o bloqueio.

O Bloco A ainda requer login legítimo, recuperação de senha autorizada, persistência e isolamento entre contas no Preview hospedado. O Bloco B ainda requer configuração externa e homologação real de contratação, confirmação, renovação e cancelamento. Testes em memória não substituem essas evidências.

## Preservações

Consulta ao Social QA somente leitura: usuários, pedidos, pagamentos, assinaturas, acessos, progresso e filas continuam zerados; objetos do preflight presentes. Não houve migração, credencial alterada, abertura de gate, envio, cobrança, chamada paga ou promoção a produção. Nenhuma lógica de robô foi modificada.

## Correção de compatibilidade do build

O primeiro candidato `522b447b4d9c6b1e1f621ac72dd71728651ee53c` passou nos testes, mas o build recusou a exportação `maxDuration` da rota Social. O limite preexistente de 60 segundos foi movido para a entrada específica `app/api/jenios-pay/checkout/route.js` em `vercel.json`. Os crons, os gates e as demais rotas não foram alterados. Não foi desativada nenhuma checagem de tipos. A configuração externa é exercitada no Preview; o teste local preserva o contrato e a CI repete o build.
