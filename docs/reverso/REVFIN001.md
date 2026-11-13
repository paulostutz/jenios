# Reverso — planos e acompanhamento financeiro (REVFIN001)

Estado desta árvore: candidata local; execução, emissão, débito e checkout reais desativados. A versão publicada é a base `0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47`. Este documento não autoriza publicação nem cobrança.

## Escopo

O catálogo existente recebe duas ofertas separadas e inativas: `platform-reverso-monthly`, R$ 19,90 por mês; `platform-reverso-annual`, R$ 199,00 em pagamento único por 12 meses. Os preços e a atividade dos produtos anteriores são preservados. O checkout genérico não pode ativar estas ofertas por uma simples alteração de `active`.

O acesso de entrada é contado da confirmação verificável do pagamento, em meses de calendário no fuso `America/Sao_Paulo`, com ajuste do último dia do mês. O começo é inclusivo e o término exclusivo. Um recibo pago não substitui a confirmação do vínculo de acesso. Cancelamento ao fim da vigência preserva o período pago. Estorno, revogação e pagamento incerto são estados diferentes.

Os direitos históricos precisam de referência explícita ao contrato anterior e conservam preço, datas e regra aceita. Nenhum plano existente passa a incluir Reverso por inferência. O percentual de 10% exige um mapa aprovado para o plano, produto e versão de termos do Reverso. A oferta de entrada prevê 20%; se a política aceita não estiver comprovada, seu percentual permanece pendente.

A candidata do runtime contém a nova versão do produtor nativo mensal/anual sobre CB006/CB014, em `lib/platform/reverso/subscription/producer-v1.mjs` e seu SQL versionado. O produtor é restrito ao laboratório sintético, sem montagem HTTP ou transporte financeiro real. Ele conserva pedido, aceite, identidade, journal e comprovante originais; o período de acesso decorre da confirmação verificada. Sua existência no código não ativa as ofertas nem o checkout.

Os consumidores Platform têm uma opção explícita de RPC isolado, `JENIOS_REVERSO_PLAN_ISOLATION_V1`, desativada por padrão. Essa opção impede tratar a assinatura avulsa Reverso como acesso geral da Platform e preserva os direitos anteriores. A montagem produtiva do produtor, suas dependências e os RPCs isolados exigem rollout coordenado e homologação; nenhuma opção de ambiente foi ativada nesta candidata.

## Interface e autenticação

- Cliente: `/platform/reverso`, com sessão dedicada da Platform.
- Admin: `/platform/admin/robos/reverso`, com a permissão existente `platform.admin`.
- API cliente: `GET /api/platform/reverso/state`; titular obtido da sessão, sem parâmetro que permita escolher outro cliente.
- API Admin: `GET /api/platform/admin/robots/reverso?subject=UUID`; o titular consultado é explícito, e a autorização administrativa é conferida novamente depois das leituras.

As páginas usam a carteira, operações, apurações, ciclos e obrigações retornadas por fontes de servidor. Nenhuma página emite compra, inicia robô, cria carteira ou envia débito. A tabela de operações preserva conta, conexão, corretora, ambiente, moeda, robô e identificador da operação.

Os novos links ficam na navegação da conta e na administração existente de robôs. Não foi criado um painel financeiro independente.

## Contrato de leitura

`REVERSO_OWNER_STATE_V1` contém blocos independentes: `entitlement`, `wallet`, `operations`, `performance`, `cycles`, `obligations` e `policy`. Cada bloco informa disponibilidade, modo e instante da observação. Ausência de fonte mantém `data:null`; não produz saldo zero ou participação zero.

`createReversoRuntimeSource` usa o mesmo host e credencial de serviço já previstos para o runtime Ultra, no caminho separado `/v1/reverso/state`. `REVERSO_RUNTIME_READ_ENABLED` permanece não configurado. A requisição interna é exclusivamente de leitura, autentica o serviço, vincula um nonce, fixa o robô e valida o titular e a atualidade da resposta. Não há fallback para arquivos de demonstração.

O runtime deve montar `createReversoStateComposition` da candidata correspondente com fontes autorizadas. A fonte nativa de acesso, os vínculos comerciais e as fontes de ciclos/obrigações devem ser resolvidos no servidor. Objetos enviados pelo navegador não são provas de pagamento ou de elegibilidade.

O leitor revalida o titular ao terminar a composição. A validade da evidência de acesso (`sourceValidUntil`) atravessa todas as projeções e é conferida também ao concluir as etapas assíncronas do runtime e da rota HTTP. Uma mudança de conta, revogação, expiração ou autorização administrativa invalida o resultado anterior.

O [contrato de histórico financeiro](REVFIN001-FINANCIAL-HISTORY.md) descreve a leitura de até 120 competências e o recorte das 200 operações mais recentes. Ele preserva cada competência e moeda, aceita retratos da mesma operação em meses distintos e rejeita duplicatas no mesmo escopo. A fonte persistida pode entregar apurações e obrigações em um único retrato, cuja revisão é revalidada ao terminar; uma mudança concorrente torna esses blocos indisponíveis sem apagar acesso, carteira ou ciclos válidos.

## Cálculo e apresentação

A candidata do runtime reaproveita o journal atribuído R127, o redutor R129 e a matemática mensal UM001/R129. A identidade de Reverso é gravada antes de uma execução fictícia e conferida no reinício. Um arquivo de Ultra não é reaberto como Reverso. O comportamento padrão dos helpers compartilhados continua Ultra.

O motor privado R114 recuperado permanece preservado, sem reconstrução de suas regras. Seu uso nesta candidata continua delimitado a `observe_reverse`/simulação; não há ativação de execução real.

A demonstração apura a competência mensal do conjunto de contas explicitamente autorizado. Ganhos e perdas realizados compensam-se dentro dessa competência e desse conjunto. As taxas da corretora, financiamento e custos elegíveis da plataforma são exibidos separadamente; estes custos entram exatamente uma vez no líquido apresentado. Quantidades preservam as 12 casas do contrato compartilhado. Valores monetários usam aritmética decimal exata e conservam o sinal das taxas aceito pelo motor.

A apuração de demonstração usa `ready_in_test` ou `no_performance_due_in_test`. Esses estados, por si só, não comprovam obrigação persistida, emissão ou recebimento. Uma obrigação efetivamente persistida é identificada separadamente por `obligationId`; a proposta anterior permanece preservada. O cálculo e o pagamento são tratados em blocos separados.

Para apresentar recebimento, o adaptador exige o vínculo original da obrigação, resolvido separadamente, e um comprovante central que coincida em titular, produto, empresa, recebedor, entidade jurídica, finalidade `reverso_monthly_performance`, valor, moeda e período mensal. `paid` sem essa prova permanece incerto. Uma demonstração nunca libera acesso, execução ou cobrança real.

## Pendências que não foram convertidas em regras

- Compensação de perdas de meses anteriores: a política vigente recuperada não fecha a regra; a participação fica pendente quando relevante.
- Arredondamento de frações de centavo e conversão de moedas: sem regra comprovada, não há emissão.
- Custos incompletos, conta ausente, fechamento parcial e atribuição incerta: mantêm pendência e participação nula.
- Inclusão do Reverso em outros planos: depende de mapa aprovado específico; direitos anteriores não são reescritos.
- Montagem produtiva do novo produtor mensal/anual, finalidade Reverso, vínculos comerciais e RPCs isolados: exigem homologação e rollout coordenados. A pendência é a ativação validada dessas ligações, não a ausência do produtor candidato.
- Taxa de Start do Ultra: não foi transferida ao Reverso.

## Verificação e preservação

Os testes `reverso-access`, `reverso-state`, `reverso-history` e `reverso-ui` cobrem calendário e limites, 10%/20%, direitos históricos, estados de pagamento, isolamento de identidade/robô, histórico mensal, falhas de fonte, mudança concorrente de revisão, sessões, Admin e apresentação. A candidata do runtime contém os testes compostos e financeiros, incluindo journal, concorrência, recuperação e integridade dos loaders.

`scripts/finalize-reverso-web-release.mjs` só produz o manifesto de fonte exata da candidata. O verificador publicado foi preservado integralmente em `scripts/check-reverso-web-baseline.mjs`; o checkpoint local de histórico também foi preservado em `scripts/check-reverso-web-history.mjs`. A nova cadeia executa as verificações herdadas nos snapshots exatos e confere separadamente os bytes da fonte atual. As seis substituições herdadas ficam restritas ao catálogo, seu teste, dois links de navegação e dois consumidores que selecionam RPCs isolados mediante opção explícita, desativada por padrão. Não se alteram gates de ambiente ou autorização produtiva.

Depois do congelamento da fonte: revisar o inventário, finalizar o manifesto, adicionar exatamente os arquivos ao índice, rodar o verificador e `npm run build`. Logs e hashes da execução final acompanham o checkpoint externo. Qualquer edição posterior exige nova revisão de inventário e validação; uma aprovação de teste não é uma publicação.
