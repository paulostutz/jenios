# JENIOS Ultra R116 — preparação no ambiente do trader

O trader instala o robô no próprio computador ou VPS e conecta sua conta. A JENIOS não precisa ter conta em corretora nem receber as credenciais do cliente.

Este pacote fornece configuração, diagnósticos de conexão somente de leitura e cálculo de resultados de relatórios locais. **Não envia ordens. As pontes de execução automática ainda não estão liberadas nesta versão.** O resultado de um diagnóstico não é homologação de negociação.

## Instalação

1. Instale Node.js 24 LTS pelo distribuidor oficial (https://nodejs.org/). Extraia o pacote em uma pasta própria. Não há dependências npm para instalar.
2. Na JENIOS, guarde seus mercados, capital e limites; leia a orientação de alavancagem quando apresentada. Clique em **Baixar minha configuração** e copie o JSON para esta pasta.
3. No terminal, dentro da pasta extraída:

```sh
node scripts/platform/ultra/client.mjs plan jenios-ultra-configuracao.json
```

O arquivo não contém senha, chave de corretora, acesso à JENIOS ou autorização de ordens. Alterar o arquivo não concede permissões na corretora. Ao mudar a configuração, revise e exporte novamente.

## Conectar sua conta localmente

Configure as variáveis abaixo apenas no computador/VPS do trader, usando o gerenciador de segredos do sistema ou a sessão local do terminal. Não envie seus valores ao suporte ou pelo chat. Os diagnósticos não imprimem as credenciais.

| Mercado | Ambiente do trader | Variáveis locais | Verificação incluída |
| --- | --- | --- | --- |
| Cripto | Conta própria Binance USDⓈ-M Futures com API disponível para sua conta/região | `JENIOS_ULTRA_ENVIRONMENT` (`demo` ou `live`), `JENIOS_BINANCE_API_KEY`, `JENIOS_BINANCE_API_SECRET` | Horário e consulta autenticada da conta. Não altera alavancagem, não envia/cancela ordens. |
| Forex / índices internacionais | Windows, Python 64 bits, pacote oficial `MetaTrader5`, terminal MT5 aberto e autenticado pelo trader | `JENIOS_ULTRA_ENVIRONMENT`, `JENIOS_MT5_ACCOUNT`, `JENIOS_MT5_SERVER`; opcionais `JENIOS_MT5_TERMINAL_PATH`, `JENIOS_PYTHON` | Conta e servidor correspondentes, ambiente demo/real e permissões de negociação. Sem ordens. |
| B3 / Profit | Windows e ProfitDLL de roteamento licenciada pelo fornecedor para o trader | `JENIOS_PROFIT_DLL_PATH` (caminho absoluto da DLL oficial); opcional `JENIOS_PYTHON` | Carregamento da DLL e símbolos necessários. Ainda não autentica nem concilia uma conta da corretora. |

```sh
node scripts/platform/ultra/client.mjs doctor binance
node scripts/platform/ultra/client.mjs doctor mt5
node scripts/platform/ultra/client.mjs doctor profit
```

Use somente a linha do seu mercado. Profit Pro instalado, isoladamente, não comprova licença de roteamento via DLL. A licença, SDK e conta são do trader. O SDK proprietário não é redistribuído neste pacote.

Um diagnóstico com `connected: true` significa que a consulta local funcionou. `executionAvailable: false` permanece até a entrega dos executores. Não há um comando escondido para iniciar ordens nesta versão.

## Resultados financeiros

O comando abaixo lê um relatório no formato `JENIOS_ULTRA_LOCAL_REPORT_V1`. Não coleta automaticamente o extrato da corretora nesta versão.

```sh
node scripts/platform/ultra/client.mjs report relatorio-ultra.json resultado-calculado.json
```

O arquivo de saída é novo; um arquivo existente não será sobrescrito. Para ver no painel, abra **Resultados do meu ambiente local** e selecione o relatório original. O processamento ocorre no navegador, sem upload. É possível selecionar período, ver acumulado e operações, consultar dias e exportar CSV.

Formato para o conector (valores monetários são strings decimais com até oito casas):

```json
{
  "schema": "JENIOS_ULTRA_LOCAL_REPORT_V1",
  "environment": "demo",
  "provider": "mt5",
  "connectionLabel": "Minha conta de demonstração",
  "generatedAt": "2026-11-10T12:00:00Z",
  "operations": []
}
```

Cada operação deve conter somente: `id`, `symbol`, `market` (`b3`, `crypto` ou `forex` correspondente ao provedor), `currency` (`BRL`, `USD`, `EUR` ou `USDT`), `side` (`buy`/`sell`), `openedAt`, `closedAt`, `gross`, `fees`, `financing`, `complete: true`, `source: "broker"`. Datas devem incluir horário e fuso. O conector deve preencher essas informações a partir dos comprovantes da corretora; a indicação de fonte no arquivo não constitui verificação independente pela JENIOS.

`gross` é o resultado bruto realizado; `fees` inclui os custos de entrada e saída, sem valores negativos; `financing` é o custo líquido de funding/swap (créditos são negativos). O resultado líquido é **bruto − taxas − financiamento**. Ganhos somam os líquidos positivos; perdas somam o módulo dos líquidos negativos. Não misture depósitos, saques, operações de outro robô ou posições ainda abertas. Não preencha custos desconhecidos com zero.

O acumulado corresponde ao conteúdo do arquivo. Moedas e ambientes não são consolidados entre si. IDs duplicados, campos desconhecidos e operações incompletas são rejeitados. Limites: 20 mil operações e 5 MB por arquivo; para históricos maiores, será necessário o coletor paginado ainda pendente.

## O que falta para operar automaticamente

- Binance Futures: executor de ordens, proteção, conciliação de fills/posições e atribuição completa de taxas/funding.
- MT5: ponte de execução por conta, especificações/lotagem, SL/TP, retomada e extrato conciliado.
- Profit: integração com o SDK oficial de roteamento, callbacks, posições e custos.
- Validação dessas pontes em contas demo do próprio trader/provedor e coleta automática dos resultados. Não depende de acesso da JENIOS às contas reais dos clientes.

O núcleo de sessão e diário persistente R116 foi validado com adaptadores fictícios controlados. Não é prova de operação real nem de rentabilidade. O aviso de alavancagem permite manter o valor escolhido; não substitui margem disponível, restrições do provedor e integridade da conexão.

Referências dos fornecedores consultadas em 10/11/2026:
- https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info
- https://www.mql5.com/en/docs/python_metatrader5
- https://ajuda.nelogica.com.br/hc/pt-br/articles/13312468554651-Como-rotear-ordens-com-a-ProfitDLL
- https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos
