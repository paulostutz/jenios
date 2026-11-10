# JENIOS Ultra R118 — checkpoint técnico, ainda não operacional

Base oficial preservada: `25770702de5acfa2eb5e7e6d44a62386eba37a93`, R117/PR35,
branch `release/jenios-genios-g44-20261024`. Este checkpoint não autoriza nem envia
ordens reais ou paper externo. Não foi promovido para produção.

A prioridade atual é Binance Spot, Binance Futures alavancado e mini índice
futuro via Profit. São produtos distintos. Mini índice é um contrato futuro da
B3, não um ativo do mercado à vista. Não há promessa de lucro por liquidez,
alavancagem ou aprovação de testes.

## Implementado e verificável sem conta

- Intenção, operação inicial e fila de sincronização persistidas antes do envio
  ao adaptador de testes; recibo, revisão financeira e estado salvos atomicamente.
- Reconciliação de resposta perdida sem repetir ordem; reinício, pausa,
  preflight e consentimento ao retomar, recusa, ordem ainda não preenchida,
  preenchimento parcial, cancelamento do restante e encerramentos parciais.
- Fechamento total exige confirmar a exposição e o fim da entrada remanescente.
  Respostas sem efeito não confirmam cancelamento/fechamento. Comandos que
  comprovadamente não foram enviados podem receber nova tentativa explícita.
- Resultado líquido somente em encerramento com todos os custos completos;
  taxas e funding tardios geram revisão auditável, sem nova operação.
- Seleção/dimensionamento reutilizam R53/R18 e as regras R115 existentes.
  Mercado fechado, cotação atrasada, liquidez não verificada, falta de margem ou
  de proteção interrompem novas entradas. Não há novo universo de ativos reais
  conectado a essas métricas, nem estimativa inventada de liquidez para Forex.
- Coleção GET de evidências USDⓈ-M por referências duráveis exatas: ordens,
  fills/comissões, contexto de posição e funding. Não presume propriedade de
  posição da conta nem atribui funding por símbolo ao robô.
- Preflight puro USDⓈ-M com produto explícito, regras de instrumento, inventário,
  margem mínima, alavancagem já configurada e preços de proteção. Seu resultado
  mantém `canSubmit=false`: não é um executor nativo.
- MT5 read-only: recupera entradas antigas encerradas dentro da janela atual.
- Profit: inventário local de pacote, arquitetura e arquivos candidatos, sem
  carregar DLL, executar SDK ou enviar seu conteúdo a qualquer servidor.

## O que falta para operar a conta

| Produto | Código neste checkpoint | Dependências restantes |
| --- | --- | --- |
| Binance Spot | Histórico R110 separado, não incorporado como executor Ultra | Adaptador Spot próprio, coleta/ciclo integrado, inventário/proteções e validação nativa. Não reutilizar rotas Futures. |
| Binance USDⓈ-M Futures | Coletor de evidências e preflight puro; ciclo apenas com fixture | Executor nativo, callbacks/eventos, fluxo de mercado real, proteções, identidade de conta independente da chave, atribuição de posições/custos e homologação. |
| Profit / mini índice futuro | Inventário e contrato histórico R109 | `ProfitDLL.zip` oficial licenciado, binário `Win64/ProfitDLL.dll` ou `Win32/ProfitDLL.dll` da arquitetura escolhida, manual e declarações nativas da mesma versão, Windows, licença de roteamento, ponte e homologação nativa. |
| MT5 | Coletor read-only corrigido | Terminal Windows autenticado, pacote oficial MetaTrader5, executor, custos separados do deal e homologação nativa. |

Não foram encontradas as dependências licenciadas Profit no repositório. Não se
inventaram headers, estruturas de ABI ou callbacks. A presença de arquivos não
comprova origem, licença, ABI ou acesso ao roteamento. O nome exato do arquivo de
declarações/manual deve ser conferido no pacote entregue pela Nelogica.

O ambiente usado é Linux em nuvem. Não houve terminal Windows, DLL licenciada,
conta autenticada de corretora, interface autenticada do trader ou ensaio nativo
com execução. A interface web existente e o banco R117 não foram alterados.
Cada trader conecta a própria conta e mantém credenciais no próprio computador
ou VPS. Não envie chaves, senha, licença ou token em chat ou Git.

## Qualificação offline

Requer Node.js 24. Execute em uma pasta **nova**, sem dados reais:

```sh
node scripts/platform/ultra/qualify-offline.mjs ./qualificacao-nova
```

O comando chama somente `OfflineFixtureBroker`, sem rede ou credenciais. Cria
três diários SQLite e `qualificacao-offline.json` nessa pasta. O esquema é
`JENIOS_ULTRA_OFFLINE_QUALIFICATION_R118`, separado do esquema de telemetria.
Esses dados sintéticos não são enviados ao painel e não devem ser importados
como operações reais. Nunca reutilize essa pasta como diário de uma conta.

Testes locais:

```sh
node --test tests/platformUltraR118Execution.test.mjs tests/platformUltraR118BinanceCollector.test.mjs tests/platformUltraR118BinancePreflight.test.mjs tests/platformUltraR118CLI.test.mjs
python -B scripts/platform/ultra/test_mt5_collector.py
python -B scripts/platform/ultra/test_mt5_collector_r118.py
python -B scripts/platform/ultra/test_profit_sdk_inventory.py
```

## Inventário do SDK Profit sem execução

Obtenha o pacote somente na conta licenciada Nelogica, em Assinaturas > DLL Feed.
Não se exige que a JENIOS tenha uma conta de corretora do trader.

```sh
python scripts/platform/ultra/profit_sdk_inventory.py /caminho/local/ProfitDLL.zip
```

Também aceita a pasta extraída. Apenas lê arquivos e calcula hashes. Os campos
`officialAuthenticityVerified`, `licenseVerified`, `abiVerified` e
`nativeRoutingValidated` continuam falsos. Ainda é necessária revisão da versão
oficial e implementação da ponte. Não substitua isso por uma DLL de terceiros.

## Coleta Binance de evidências, sem negociação

A chave HMAC existente, configurada localmente pelo titular, é lida de
`JENIOS_BINANCE_API_KEY` e `JENIOS_BINANCE_API_SECRET`. O pacote não cria chaves,
não muda permissões, não habilita negociação e não configura alavancagem.
Use o menor acesso necessário para leitura.

```sh
node scripts/platform/ultra/collect-r118.mjs identify-binance demo
```

Esse comando não usa rede e informa a impressão da chave/ambiente, não o UID da
conta. Crie um perfil **sem credenciais**, com estes campos:

```json
{
  "schema": "JENIOS_ULTRA_BINANCE_READONLY_PROFILE_R118",
  "product": "usds_m_futures",
  "environment": "demo",
  "expectedKeyFingerprint": "IMPRESSAO_LOCAL_DE_64_HEXADECIMAIS",
  "references": [{"symbol": "BTCUSDT", "orderId": "ID_NATIVO", "clientOrderId": "ID_DURAVEL", "side": "BUY", "positionSide": "BOTH"}],
  "evidenceDirectory": "estado/evidencias-binance"
}
```

Os IDs são placeholders, não uma autorização de consulta ou evidência de
propriedade. Substitua-os pelas referências exatas do diário local. Uma chave
alterada exige reconciliação da identidade, não troca automática de conta.

```sh
node scripts/platform/ultra/collect-r118.mjs binance perfil-binance.json --once
```

Sem `--once`, repete a coleta a cada 60 segundos até Ctrl+C. Os arquivos ficam
somente no diretório privado local. O coletor **não** transforma `FILLED` em
posição encerrada, não consolida líquido e não sincroniza evidências incompletas
com o painel. Ainda falta essa integração ao ciclo nativo. Não aceita produto
Spot por inferência. Consulte `R118-CONNECTOR-EVIDENCE.md` para retenção/limites.

## MT5 corrigido, somente leitura

Use o mesmo perfil e diário do R117, sem recriar histórico nem copiar credenciais.
Com o terminal já autenticado pelo titular:

```sh
node scripts/platform/ultra/collect-r118.mjs identify-mt5 perfil-mt5.json
node scripts/platform/ultra/collect-r118.mjs mt5 perfil-mt5.json --once
```

Sem `--once`, consulta a cada 60 segundos. O código de sincronização já
configurado localmente permite enviar os registros MT5 ao painel existente.
`positionCostsComplete=false` deve permanecer até comprovar todos os custos,
inclusive cobranças separadas dos deals. Demais comandos de relatório/exportação
e sincronização R117 continuam disponíveis em `operations.mjs`.

## Continuidade

Não publicar como “Ultra autônomo concluído”. Próxima etapa: adaptar e validar
cada produto em seu ambiente nativo, comprovar identidade/recibos/proteções e
fechar atribuição de custos. A ativação e qualquer operação financeira na conta
continuam com seu titular. Nenhuma solicitação para movimentar conta foi feita
por esta implementação.
