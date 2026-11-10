# R127 — conciliação dos trabalhos paralelos

## Bases verificadas em 10/11/2026

O inventário inicial encontrou a R124 publicada, a R125 candidata e a Flow v31.
A conferência final encontrou duas entregas posteriores. Esta frente foi então
renumerada de rascunho R126 para R127, sem publicar o rascunho nem substituir
as novas entregas.

| Frente | Evidência | Tratamento nesta entrega |
| --- | --- | --- |
| JENIOS publicada | R124 `d63f26ca9ddb9987f74cd62aabe0f42bc181ab63` | Preservada; sem merge ou implantação. |
| JENIOS R126 paralela | Fonte original `02f547531d4e2353fa1c397d0a6cb2b8edb68b2c`; 11 hashes da entrega conferidos | Base integral da R127; os 1.398 arquivos foram comparados com o TAR original. |
| Flow v32 | Fonte `ad8d10f27c6ca4cb8cd927a44a9a4c251e3dab60`; versão salva, sem deployment | Lida e preservada; nenhum arquivo ou configuração da Flow foi alterado. |
| Kivoryn OPSCON001 | Checkpoint de continuidade salvo às 20:32 UTC | Mantido separado; não oferece contrato de execução Ultra/fills e deixa a integração Ultra para depois. |

A R126 paralela acrescenta a tela autenticada `/platform/ultra/teste`, exemplos
fictícios, ensaio local e pacote. O runtime, os diários e os coletores R118 são
idênticos aos da R125 recuperada. A R127 conserva a tela, o ensaio, o pacote e o
manifesto R126. Seus próprios arquivos, classes, schemas e tabelas usam R127.

O único arquivo herdado alterado por este delta é o verificador de inventário:
acrescenta os hashes da R127 e continua verificando todas as fontes anteriores.
Não troca hashes históricos nem aceita caminhos extras. O Profit R109 importado
mantém os bytes do trabalho original.

## Interface com a Flow v32 e o relatório mensal

As cinco fontes compartilhadas abaixo permanecem idênticas entre JENIOS e
Flow v31/v32: `operation.mjs`, `reporting.mjs`, `client/plan.mjs`,
`client/reporting.mjs` e `client/workspace-report.mjs`.

A v32 não contém executor ou conector nativo novo. Seu leitor mensal continua
baseado no contrato `JENIOS_ULTRA_OPERATIONS_V1`. A interface R127 tem schema
próprio porque precisa preservar prova de origem, revisão e associação de
recibo; ela é recusada pelo leitor legado. Não reduzir esse envelope ao formato
antigo eliminando os campos que distinguem simulação e confirmação.

O consumidor da outra frente precisa:

1. Validar `JENIOS_ULTRA_OPERATION_RECORD_BATCH_R127`, conta vinculada,
   proprietário, conexão, fornecedor, ambiente, produto e moeda.
2. Deduplicar por `eventId` e guardar a maior revisão por `operationKey`.
   Os registros são snapshots completos; somá-los duplicaria a mesma operação.
3. Preservar `evidenceMode`, `receiptRecorded`, `result.status` e custos pendentes.
   A existência de recibo fictício não constitui confirmação da corretora.
4. Processar revisões tardias de custos da mesma operação e salvar o cursor
   somente após concluir o lote. Não converter campos ausentes em zero.
5. Manter a correlação técnica `sessionId` separada da decisão comercial de Start.
   Período mensal, fuso comercial, taxas e elegibilidade continuam com a outra frente.

Nenhum consumidor financeiro, rota de ingestão ou regra de cobrança foi criado
ou conectado. O mês UTC do leitor mensal v32 continua uma convenção de consulta
local; não define o fuso de faturamento.

## Configuração: ligação ainda necessária

A configuração exportada pela Flow v32 usa o formato R116, sem fornecedor e sem
produto Spot/Futures explícitos. Antes de ligá-la ao runtime R127, será necessário
confirmar a rota selecionada pelo titular e o produto elegível. Não aplicar
defaults silenciosos para substituir a escolha exibida na interface. A política
R125 admite cripto pendente e tem MT5 como opção inicial B3; o fluxo legado de
migração possui regras próprias. Nenhuma dessas regras comprova conexão.

O leitor legado da Flow ainda associa MT5 a Forex; o caminho B3/MT5 preparado na
R125 precisa de adaptação explícita do consumidor, sem reinterpretar históricos.
Esta entrega não muda a UI ou o leitor mensal em paralelo para fazer essa ligação.

## Alcance da validação

Os totais publicados pela outra frente continuam sendo evidências daquela
entrega. Não são somados aos testes próprios da R127. A fonte, os hashes e os
contratos relevantes foram conferidos aqui; o checkpoint final registra a
bateria dirigida executada após a composição.

O teste histórico de reconstrução do ZIP R126 usa o objeto Git original R125
`8cd35ab6caedac31ea327c72e037de43bc309c48`, que não está disponível no repositório
remoto consultado. O teste e seu pin foram preservados. A validação própria da
R127 usa o pacote predecessor de hash verificado, compara todos os seus membros,
reconstrói o pacote novo e executa os módulos extraídos fora do checkout Git.
Isso não equivale a declarar novamente aprovado todo o build histórico R126.

Permanecem pendentes: QA visual/autenticado das telas candidatas, transporte
nativo por fornecedor, licença/SDK/terminal, conta elegível, provas de fills,
posição e custos, proteção e recuperação na corretora. Não houve ordens externas,
fundos reais, coleta de credenciais ou integração com a Exchange Kivoryn.
