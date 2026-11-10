# R125: inspeção local de mini índice e mini dólar via MT5

## Resultado e escopo

Este delta adiciona uma inspeção de leitura ao coletor R118 existente. Não reconstrói as estratégias Ultra, não implementa execução e não declara uma conta conectada ou validada sem observação local.

O escopo desejado do Ultra é **mini índice, mini dólar e cripto**. Neste componente MT5, o escopo é somente **candidatos de contratos com vencimento WIN/WDO**, informados explicitamente pelo titular. A rota nativa/API de cripto na Genial **não foi comprovada** e não é implementada aqui. MT5 não constitui prova de acesso a Forex, ações comuns ou cripto para o Ultra.

Arquivos deste delta:

- `scripts/platform/ultra/mt5_readiness_r125.py`
- `scripts/platform/ultra/test_mt5_readiness_r125.py`
- Este documento.

Os arquivos R117/R118 permanecem inalterados. A classe reutiliza `MT5Collector` de `mt5_collector_r118.py`, incluindo o vínculo local de conta/servidor/ambiente. Um adaptador pequeno passa o caminho de inicialização na forma posicional documentada pela MetaQuotes, sem modificar o coletor anterior.

## O que as fontes oficiais comprovam

A Genial informa que o cliente pode programar seu próprio robô em MQL5 e descreve sua oferta MT5 para o mercado brasileiro. Os artigos consultados **não estabelecem aprovação obrigatória de cada robô**. Isso não prova que o código JENIOS, determinada conta, um símbolo ou uma rota Python já tenha sido testado.

- [Genial: tipos de robô permitidos no MT5](https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/360055400032-Que-tipo-de-rob%C3%B4-eu-posso-usar-para-operar-no-MetaTrader-5)
- [Genial: funcionamento do MT5](https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/360047237751-Como-funciona-a-plataforma-MetaTrader-5)

O pacote oficial `MetaTrader5` comunica-se com o terminal local. Um EA MQL5 dentro do terminal e um processo Python externo são mecanismos diferentes. A permissão Python tem um controle próprio, `tradeapi_disabled`, independente das permissões da conta e da negociação automática do terminal. A inspeção apenas lê esses controles.

- [MetaQuotes: integração Python](https://www.mql5.com/en/docs/python_metatrader5)
- [MetaQuotes: campos do terminal](https://www.mql5.com/en/docs/python_metatrader5/mt5terminalinfo_py)
- [MetaQuotes: configurações de negociação automática e Python](https://www.metatrader5.com/en/terminal/help/startworking/settings#expert_advisors)

ProfitDLL é outra biblioteca e outra rota de dados/roteamento. A licença ou integração Profit não é pré-requisito presumido para esta rota MT5.

- [Nelogica: ecossistema ProfitDLL](https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos)

## Dependências e execução deliberada pelo titular

A importação de `mt5_readiness_r125.py` não importa o SDK e não inicializa terminal. Os testes injetam um terminal fictício em memória.

A CLI real só carrega o SDK quando iniciada explicitamente com `--inspect-terminal`, em Windows. A distribuição oficial examinada foi `MetaTrader5 5.0.6231`: wheels Windows x86-64, dependência declarada `numpy>=1.7`. A combinação concreta de Windows, CPython, NumPy, SDK e terminal deve ser verificada localmente; não foi instalada nem testada contra Genial neste delta. pandas e matplotlib não são usados por este inspetor.

- [Metadados oficiais da distribuição examinada](https://pypi.org/pypi/MetaTrader5/5.0.6231/json)

**Atenção à inicialização:** a função oficial `initialize()` pode abrir o terminal e reutilizar a última conta e credenciais já salvas nele. Omitir `login()` não torna essa operação uma conexão estritamente limitada a um processo já aberto. A API documentada não oferece uma opção `attach-only`. Só o titular deve iniciar essa inspeção deliberadamente no ambiente local correto, após conferir terminal, conta, servidor e ambiente. O resultado não altera permissões nem solicita senha.

- [MetaQuotes: comportamento de initialize](https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py)

O titular reutiliza um perfil R118 cuja vinculação já tenha sido conferida localmente. Permanecem no computador dele:

- `JENIOS_MT5_ACCOUNT`: conta esperada.
- `JENIOS_MT5_SERVER`: servidor exato esperado.
- `JENIOS_MT5_TERMINAL_PATH`: caminho do executável pretendido, recomendado quando existe mais de um terminal.

O perfil deve conter `provider="mt5"`, `market="b3"`, `environment="demo"` ou `"live"`, `magic` válido e `accountFingerprint` correspondente. Os demais campos existentes do perfil R118 são aceitos, mas este componente não abre seu ledger nem sincroniza informações. Campos de senha, login, servidor ou token no perfil são recusados. Não colocar credenciais em chat, servidor web, repositório ou argumento de linha de comando.

O fingerprint mantém o formato R118: SHA-256 de `mt5:<conta>:<servidor>:<ambiente>`. Serve para comparar o vínculo; não é uma credencial, prova de titularidade, assinatura ou garantia de anonimato. Deve continuar local por padrão.

## Interface

### Biblioteca com dependência injetada

`MT5Readiness(terminal, profile, now_ms=None)`

`inspect({"symbols": [...], "maxQuoteAgeMs": 5000})`

- `terminal`: SDK oficial somente no caminho deliberado do operador; objeto fictício nos testes.
- `symbols`: lista obrigatória de 1 a 20 nomes exatos, únicos, obtidos pelo titular no terminal. Não existe varredura global nem seleção automática.
- Este delta aceita apenas a forma estrita `WIN` ou `WDO`, uma letra de mês e dois dígitos de ano. A forma do nome **não comprova elegibilidade**: o código consulta esse nome exato e inspeciona o vencimento informado pelo terminal.
- Símbolos com sufixos específicos da corretora permanecem fora deste delta até revisão explícita. Não remover sufixos nem convertê-los silenciosamente.
- Nomes contínuos, curingas, nomes genéricos, Forex, ações comuns e cripto são recusados. Nenhum contrato, mês ou código é gerado pelo inspetor.
- `maxQuoteAgeMs`: inteiro de 1 a 30.000 ms; padrão 5.000. A idade é calculada ao final de toda a coleta.

### Protocolo local da CLI

Comando deliberado do titular:

`python -B scripts/platform/ultra/mt5_readiness_r125.py --inspect-terminal`

O processo recebe JSON por linhas na entrada padrão:

1. Primeira linha: perfil R118 local.
2. Demais linhas: `{"id":1,"method":"inspect","args":{"symbols":["<NOME_EXATO_DO_TERMINAL>"],"maxQuoteAgeMs":5000}}`.

O texto entre `<...>` é um marcador, não um símbolo aceito. Substituí-lo somente por um nome observado pelo titular; este documento não indica contrato vigente.

Resposta válida: `{"id":1,"ok":true,"result":{...}}`.

Falha: `{"id":1,"ok":false,"error":"CODIGO_LIMITADO","canStart":false,"executionAvailable":false}`.

`ok=true` significa apenas que a inspeção retornou um relatório. **Não significa prontidão para operar.** A CLI aceita somente `inspect`; não expõe `collect`, envio, cancelamento ou encerramento. Após a primeira falha de requisição/coleta, encerra a sessão e não processa novas requisições. A desconexão encerra o canal IPC, não fecha posições, não cancela ordens e não faz logout da conta.

## Dados retornados e verificações

Schema: `JENIOS_ULTRA_MT5_READINESS_R125`.

- Fingerprint, ambiente, moeda BRL, modo de margem da conta, build do terminal e horário/duração da observação.
- Conta, servidor e ambiente conferidos antes e depois. Troca de identidade, desconexão ou mudança nas permissões durante a coleta invalida o relatório inteiro.
- `accountTradeAllowed`, `accountExpertAllowed`, `terminalTradeAllowed` e `pythonTradingDisabled` separados. Campo ausente fica desconhecido; não recebe valor favorável por padrão.
- Para cada símbolo exato: disponibilidade, especificação de ponto/tick/contrato, volume mínimo/máximo/passo/limite, modos de cálculo/execução/preenchimento/ordem/expiração, distâncias de stops/freeze, margens de instrumento, moedas e datas.
- Bid/ask/último preço observados e timestamp. Quote ausente, inválido, cruzado, futuro ou antigo permanece pendente. Não há preço criado ou arredondamento para tornar uma ordem válida.
- Vencimento ausente, expirado, contrato ainda não iniciado, símbolo customizado ou não selecionado são explicitados. Nenhum `symbol_select` é chamado para corrigir a situação.
- Contagens de **todas** as posições e ordens pendentes do símbolo, inclusive manuais ou de outro robô. `magic` não prova propriedade. Não são retornados tickets, IDs de posição, login, servidor, nome, saldo, patrimônio, caminhos locais ou mensagens brutas do fornecedor.
- Respostas `None` de posições/ordens não viram zero. Respostas inconsistentes, com símbolos divergentes ou acima do limite de 20.000 linhas invalidam a coleta.

Chamadas observacionais: `account_info`, `terminal_info`, `symbol_info`, `symbol_info_tick`, `positions_get(symbol=...)`, `orders_get(symbol=...)`. A CLI também utiliza o ciclo `initialize`/`shutdown` já descrito. Não usa consulta global de símbolos, histórico, cálculo de margem, assinatura de book, login, `order_check`, `order_send` ou mudanças de configuração.

## Limites deliberados

Todas as respostas permanecem com:

- `canStart=false` e `executionAvailable=false`.
- `productEligibilityVerified=false` e `cryptoRouteVerified=false`.
- `marketOpenVerified=false`, `marginSufficiencyVerified=false` e `protectionVerified=false`.
- `ownershipVerified=false` e `brokerIdentityVerified=false`.

Vincular a sessão a um servidor esperado não certifica independentemente a identidade da corretora. Um símbolo existente e uma quote fresca não provam horário negociável, margem suficiente, direito ao produto ou ordens protetoras. Margens de instrumento não são saldo/margem livre da conta. As leituras sequenciais não são uma transação atômica nem uma conciliação de exposição. Trocar de conta e voltar entre duas observações também não pode ser excluído por essa fotografia.

O diagnóstico não executa a estratégia. Continuam pendentes o transporte de ordens, observações reais que alimentam o Ultra, vinculação durável de intenção/ordem/negócio, tratamento de resultado incerto, proteção, cancelamento/fechamento parcial, conciliação netting e custos completos. Nenhuma flag de segurança deve ser removida por causa de um relatório de leitura.

## Validação deste delta

Comando usado, sem inicializar terminal real:

`PYTHONDONTWRITEBYTECODE=1 python -B -m unittest discover -s scripts/platform/ultra -p 'test_mt5_readiness_r125.py' -v`

**30 testes passaram**, exclusivamente com fixtures. Cobrem identidade antes/depois, mudança de ambiente/permissões, recusa antes da inicialização para vínculo incorreto, protocolo opt-in, método único, preservação de privacidade, nomes explícitos WIN/WDO, ausência de seleção/rolagem, especificações faltantes, quotes antigas/futuras/cruzadas, vencimento, exposição de qualquer origem e erros nativos sanitizados.

Nenhum SDK foi instalado; nenhum terminal ou conta real foi conectado; nenhuma ordem ou verificação de ordem foi submetida; nenhuma permissão foi alterada. Os símbolos `WINZ99`/`WDOZ99` usados nos testes são rótulos fictícios de fixtures, não contratos consultados ou recomendados. Esta validação não substitui inspeção posterior no terminal Genial do titular.
