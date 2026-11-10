# Ultra R126: teste sem dinheiro real

Esta entrega prepara um ensaio verificável, não operação autônoma na corretora. Nenhuma ordem real, ordem em paper externo ou cobrança é habilitada. O ensaio não prevê lucro nem valida uma estratégia no mercado.

## Modelo atual

Cada cliente conecta a própria conta na JENIOS, Flow ou Kivoryn. A hipótese de conta central registrada em R125 foi superada e está preservada apenas como histórico. As instruções deste documento prevalecem para a R126.

As assinaturas continuam. O modelo comercial informado é R$ 5 por sessão/Start, não por trade, sem performance do Ultra. O DeFi da Flow não é alterado. Esta entrega não modifica o mecanismo de cobrança, não cria direitos e não cobra sessões. Tratamento de falha, retomada, sessão sem trade, saldo e estorno ainda precisa de contrato produtivo e verificação na frente comercial.

## Testar a interface

Após entrar na JENIOS, abra `/platform/ultra/teste` ou selecione “Teste sem dinheiro real” na área Ultra.

1. Escolha MT5/B3, Profit/B3 ou Binance/cripto e carregue o exemplo fictício.
2. Confira nove registros, incluindo preparada, enviada, incerta, aberta, parcial, encerrada, recusada, cancelada e encerrada com custos pendentes.
3. Somente o encerramento com custos completos entra no total: 0,19 da moeda do exemplo. O bruto fictício 9.000 com custos pendentes fica de fora.
4. Troque de rota: o exemplo anterior deve desaparecer. Carregue novamente e confira a moeda. Limpe o teste, volte ao Ultra e repita.

A tela não pede credenciais, não grava o exemplo, não exporta operações fictícias, não faz upload e não realiza chamadas a corretoras ou cobrança. Os únicos dados são exemplos fabricados no navegador. O relatório é calculado pelos validadores e pela contabilidade R124/R125 existentes, sem gráficos.

## Ensaio do motor e do diário, sem conta

Requer Node.js 24. Extraia o ZIP e, na pasta extraída, execute:

```sh
node scripts/platform/ultra/rehearse-r126.mjs
```

Não são necessários npm install, chave, senha, terminal ou SDK. O comando não aceita parâmetros de conta. Cria uma pasta temporária nova por execução, com diários SQLite exclusivamente fictícios e `resultado-teste-ficticio.json`. Nunca envie esses arquivos à telemetria de clientes.

Resultado esperado: `passed: true`, 18 verificações, `ordersSentToBroker: 0`, `nativeValidated: false`, `liveExecutionEnabled: false`, `externalPaperEnabled: false` e `billingEnabled: false`.

O ensaio reutiliza `UltraExecutionRuntime`, `ExecutionLedger` e `OfflineFixtureBroker`. Testa B3 e cripto: resposta perdida e reconciliação sem duplicar; fechamento parcial e custos tardios; recusa; cancelamento sem fill; pausa sem fingir encerramento; desconexão/retomada sem duplicação; limite diário; proteção não confirmada; recusa de adaptador nativo. São testes do software com simulador, não do terminal Profit, MT5 ou Binance. O caminho MT5/B3 tem testes separados de diagnóstico somente leitura no pacote R125 preservado.

## O que falta para operar

- Terminal/SDK oficial e conta do titular elegível por produto. Profit exige distribuição licenciada compatível; MT5 tem caminho independente. Cripto Genial não tem rota nativa comprovada.
- Feed de mercado e evidências nativas de ordem, fill, posição, custos, cancelamento e recuperação, com isolamento da conta.
- Proteções e concorrência verificadas no ambiente real. Pausa não comprova encerramento. Gaps, liquidez e custos podem levar a perdas além do limite.
- Integração comercial autoritativa, aceite e persistência produtiva, sem duplicação.

Os módulos anteriores permanecem preservados byte a byte, salvo os pontos de UI e o destino exato de retorno de login inventariados para apontar a este teste e pacote. A guarda de inventário mantém manifestos antigos imutáveis e acrescenta R126. Nenhuma estratégia, conector, requisito de autenticação ou cobrança é relaxado.

## Histórico e limites

`GUIA-R125-HISTORICO.md` e os guias R120/anteriores descrevem checkpoints passados. O texto R125 sobre conta central não é instrução atual. O pacote antigo permanece disponível apenas para rastreabilidade.

Publicar esta interface ou passar no ensaio não significa concluir o Ultra operacional. Um teste autenticado de cliente e a conexão nativa precisam ser verificados separadamente. Nenhuma credencial ou dado real de conta está incluído.
