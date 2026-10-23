# FC04 — Jornada comercial e controles de cobrança

Base conferida: backup FC03 `backup/jenios-fc03-offline-path-verified-20261023`, commit `cdbedfccd65ade53ae0ffb46effd8a32ed7e4658`, CI `39960374881` SUCCESS. A linha B305/R35 já está incorporada nessa base. Nenhum bloco certificado foi alterado; refinamentos existem somente na candidata FC04, com as versões anteriores arquivadas e verificadas.

## Correções concretas

O gateway genérico aceitava credenciais configuradas sem consultar `JENIOS_PAY_PAYMENTS_ENABLED`. O caminho Pix também podia criar cobranças com material configurado, sem exigir as duas liberações de criação. A política compartilhada agora exige o valor literal `true` na chave geral e, no Pix, também em `JENIOS_INTER_CHARGES_ENABLED`.

O bloqueio ocorre antes de preparar pedidos, consultar o cofre ou chamar o transporte. Também alcança chamadas diretas ao cliente Pix. Consultas de pagamentos existentes continuam disponíveis para reconciliação. Universidade e créditos Pro refletem o bloqueio de novas vendas; seus fluxos de consulta não recebem essa nova restrição.

Uma segunda diferença existia entre a tela e o servidor: o catálogo da Platform não fornece `subscriptionLifecycleReady`, portanto a interface já impede contratação recorrente. O checkout direto agora respeita esse mesmo estado, antes de criar um pedido. Esta correção não implementa nem certifica o ciclo recorrente e não cria uma flag para declarar homologação por configuração.

Os testes anteriores dos transportes continuam verificando idempotência, preço, retorno, reconciliação e falhas. Suas configurações fictícias de criação agora declaram explicitamente as liberações. Nenhuma asserção foi removida. Os originais estão em `evidence/variants/fc03-before-fc04/`.

## Evidência local e consultas externas

Os 14 testes FC04 exercitam módulos existentes com identidades, bancos e respostas locais: cadastro fechado/pendente de confirmação, diagnóstico durável e repetição, separação de identidades Social/Platform, acesso à Universidade pelo plano, cancelamento agendado, expiração no instante exato, estados inativos, recusa de destinatário/vínculo incorreto, estado incerto de envio sem reenvio automático e saída da conta preservando dados das demais contas.

As transições de assinatura e de fila usadas nessa jornada são fixtures, não eventos bancários nem execução dos triggers PostgreSQL. A evidência não comprova entrega externa ou provisão de assinatura paga.

Consultas somente leitura ao ambiente de homologação confirmaram `allRequired=true` no preflight B305. As tabelas consultadas de pedidos, direitos, assinaturas, filas, Universidade e diagnóstico têm RLS habilitada; isso não substitui teste autenticado das políticas. A configuração específica da branch B305 mantém os envios e as cobranças desligados, Auth Templates e certificação do webhook em `false`; o segredo do webhook não aparece no inventário dessa branch. Não foram lidos valores de secrets, destinatários ou conteúdo das filas. Os detalhes estão em `evidence/FC04_READONLY_QA_EVIDENCE.json`.

## Aceite ainda pendente

1. Aplicar/conferir os templates Auth no ambiente correto e validar confirmação e recuperação com identidade de teste autorizada. A flag está `false`; o conteúdo do painel Auth não foi inspecionado diretamente.
2. Cadastrar o segredo do webhook Resend no escopo correto e verificar um evento assinado de bounce/complaint, antes de qualquer ativação. O parser e os workers B305 existentes foram preservados.
3. Demonstrar o vínculo servidor entre a identidade dedicada da Platform e o comprador Social/PAY, junto ao ciclo externo de ativação, renovação, cancelamento e provisão. O formulário público e o preflight sintético não comprovam esse ciclo. Onboarding permanece durável no banco Platform; seu e-mail automático não possui ponte de entrega implementada e não foi ativado.
4. Homologação das telas desktop/mobile e das jornadas autenticadas na candidata integrada: FC05.

O FC04 entrega refinamentos e evidência offline verificável, mas permanece parcial no aceite comercial externo. O núcleo privado original dos robôs continua sendo uma pendência independente do FC03, em recuperação no chat “Certificar robôs JENIOS R59”; este bloco não o substitui.

## Preservação e validação

`verify-fc03-sources.mjs` mantém os 353 hashes herdados e 33 arquivos R59. `verify-fc04-sources.mjs` compara todos os 1.525 arquivos da base FC03: 1.512 idênticos e 13 refinamentos explícitos, cada um com o original arquivado. O placar-mestre R59 permanece byte a byte idêntico, com `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` em `null`.

A CI FC04 roda R12–R59 e a variante temporal R46, os testes FC03/FC04, B305, suíte geral, Social e build/páginas. A evidência final registra as contagens e o commit efetivamente aprovado. Testes direcionados são subconjuntos da suíte geral e não devem ser somados a ela. Geração das páginas não equivale à homologação de todas as telas.

Sem produção, merge, deploy, e-mail real, cobrança, ordem real ou Paper externo. A candidata e seu backup estão com publicação automática desativada.

Validação inicial Linux: CI `39975515928`, commit `a2852193ca105e07830c9d26aa3cbd8f11772de5`, SUCCESS. Robôs 265/265, FC03 8/8, FC04 14/14, B305 85/85, geral 2.187/2.187, Social 94/94, build PASS e páginas 78/78. No macOS local, sete testes antigos de host recusaram o runtime por `UNREVIEWED_PRIVATE_WORKER_RUNTIME`; passaram sem alterações no ambiente Linux exigido. O manifesto do backup registrará a CI do commit final com este checkpoint.
