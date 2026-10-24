# JENIOS — Guia de aceitação dos robôs e da interface

## Identificação e alcance

- Base consultada: `backup/jenios-robot-r59-final-research-certified-20261023`.
- Commit da base: `f7dd8f4a0db658dcd3bd957bc403c397d08f7621`.
- Certificação de pesquisa existente: R12–R59; CI consolidada `39957136366`.
- Este guia prepara a aceitação. **Nenhum cenário manual deste documento foi executado ou aprovado nesta auditoria.**
- A revisão do código não equivale a teste no navegador, teste ponta a ponta, execução em corretora ou medição de rentabilidade.
- Os cenários devem ser executados em ambiente local ou de homologação previamente identificado. Este documento não autoriza publicação, merge, cobrança, ordem real ou Paper externo.

### Estados utilizados

| Estado | Significado |
|---|---|
| `NOT_EXECUTED` | Há um caminho de interface ou laboratório descrito, mas a execução e sua evidência ainda precisam ser registradas. |
| `BLOCKED_INTEGRATION` | O comportamento certificado na pesquisa não está demonstrado no caminho de produto auditado. Não é possível aprovar esse comportamento por meio da tela atual. |
| `PASS` | Reservado ao resultado observado depois de executar o cenário e anexar a evidência correspondente. Nenhum cenário começa neste estado. |
| `FAIL` | Reservado a uma divergência efetivamente observada durante a execução. |

## Pesquisa e interface: o que cada uma permite verificar

| Modo | Evidência de pesquisa preservada | Caminho de interface encontrado na base | Situação da integração |
|---|---|---|---|
| Manual | R56: avisos por perdas consecutivas, drawdown e confiança; operador mantém controle; sem troca automática de modo, entrada ou saída. | `/dashboard` e `/mesa-operacoes` registram intenções locais em modo `manual`. | O diário e os controles locais existem. A ligação do fluxo da tela com `evaluateR56ManualAdvisory` não foi demonstrada. |
| Híbrido | R57: guard de alinhamento congelado em 0,65, proteção do operador alinhado e ausência de intervenção com baixa confiança. | `PlatformStrategyLab` oferece **Híbrido · comparação de cenários**, usando o replay educativo B80. | O modo de replay não equivale ao Híbrido R57. A integração funcional do guard com o fluxo do operador permanece pendente. |
| Reverso | R58: reversão seletiva, exceção de megatendência, bloqueio por baixa confiança e losseshômetro somente sintético. | `/mesa-operacoes` oferece **Engenharia Reversa** e registra a intenção original com modo `reversa`. | A gravação da intenção não demonstra inversão seletiva. Na base, `executarOrdem` não chama `evaluateR58Reverse`. |
| UltraFast | Baterias R18–R55: segurança, microestrutura, recuperação e estresse em laboratório; performance real não certificada. | Localizados módulos de pesquisa e regra de plano. Não foi localizado fluxo de ativo/capital/alavancagem/Play nas telas auditadas. | A aceitação do produto UltraFast está bloqueada até existir uma integração de homologação identificável e testável. |

O valor **0,65 é o limiar da política**, não uma taxa de acerto real. Não transformar resultados de fixtures, replay ou revisão estática em resultados de corretora.

## Preparação da sessão de teste

1. Registrar o commit, o ambiente e a URL local/de homologação antes de começar. Não usar uma URL de produção para validar uma mudança que não foi publicada.
2. Usar uma identidade de testes já autorizada. Não criar bypass, alterar permissões ou inserir credenciais de produção para destravar o roteiro.
3. Para verificar compartilhamento entre Sala de Controle, Dashboard e Mesa, usar a mesma identidade e a mesma aba. Saldo fictício, pausa e diário usam armazenamento local de sessão.
4. Manter o seletor em **Simulador (Demo)**. Nenhuma etapa exige conectar corretora, autorizar ordens ou acionar transporte externo.
5. Registrar a quantidade inicial de intenções no diário. Não apagar o histórico para facilitar a contagem; verificar apenas os incrementos produzidos pelo teste.
6. A entrada com uma conta Social verificada libera somente a experiência de simulação nos caminhos previstos. Não concede diagnóstico, assinatura ou administração da Platform.
7. A área `/platform/admin` exige a permissão legítima `platform.admin`. Se a conta não a possuir, registrar o bloqueio esperado; não ampliar o acesso.
8. `/platform/homologacao` é uma página informativa. Na base, exige `VERCEL_ENV=preview` e `JENIOS_QA_CANDIDATE_ENABLED=true`; fora disso, o retorno 404 é esperado. Ela não executa a bateria R59.

Se não houver um ambiente de homologação acessível ou identidade de teste válida, manter os cenários como `NOT_EXECUTED` e registrar o impedimento. A indisponibilidade não autoriza usar produção como substituta.

## Os 14 cenários de aceitação

### 01 — Entrada e limites de acesso

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/dashboard-logado`, com identidade de testes autorizada.
- **Ação:** abrir **Área de negociação** e **Mesa e gráficos**. Quando aplicável, conferir que uma identidade Social não recebe administração ou diagnóstico privado da Platform.
- **Esperado:** navegação para `/dashboard` e `/mesa-operacoes`; simulação acessível sem exigir diagnóstico concluído; permissões administrativas permanecem independentes.
- **Evidência:** ambiente, tipo de identidade utilizado, rotas abertas e mensagem de acesso observada. Não registrar tokens ou senhas.

### 02 — Saldo fictício compartilhado na sessão

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/dashboard-logado`, seção de simulação da conta.
- **Ação:** registrar o saldo inicial, ajustar o saldo fictício para R$ 100.000 e navegar para Dashboard e Mesa na mesma aba.
- **Esperado:** as telas mostram o saldo fictício da mesma sessão. O valor não aparece como saldo bancário ou de corretora verificado.
- **Evidência:** valores antes/depois e identificação das telas. A alteração é somente na conta fictícia.

### 03 — Controle manual e registro de intenção

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/mesa-operacoes`.
- **Ação:** selecionar **Manual Puro**, capital fictício de R$ 1.000 e quantidade 1; registrar a quantidade inicial do diário; clicar **Simular compra** uma vez.
- **Esperado:** uma intenção `COMPRA`, modo `manual`, valor R$ 1.000; sem mudança automática de modo e sem alegação de execução ou lucro.
- **Evidência:** incremento do diário e conteúdo visível da nova intenção. Quando a inspeção técnica estiver disponível, o registro deve manter `source: client_simulation`, `executed: false` e `verified: false`.

### 04 — Seleção do modo Reverso na interface atual

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/mesa-operacoes`.
- **Ação:** selecionar **Engenharia Reversa** e registrar uma compra simulada de R$ 1.000.
- **Esperado:** o diário registra a intenção original e o modo `reversa`. Não deve apresentar a intenção como ordem invertida ou negócio executado.
- **Limite:** este cenário valida a seleção e o registro do modo. Não aprova guard 0,65, megatendência, inversão seletiva nem lucro do Reverso.
- **Evidência:** modo selecionado, direção da intenção e incremento do diário.

### 05 — Pausa e retomada sob controle humano

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/mesa-operacoes`, com dados fictícios válidos.
- **Ação:** clicar **Pausar sessão**, tentar uma compra simulada e conferir o diário. Depois clicar **Retomar sessão** e registrar outra intenção.
- **Esperado:** a tentativa durante a pausa não adiciona intenção; o contador de bloqueios aumenta. A retomada depende do comando humano. A intenção posterior pode ser registrada se os demais limites estiverem válidos.
- **Evidência:** estado da pausa, contagem do diário e contador de bloqueios antes/depois. Bloqueio não equivale a perda financeira evitada.

### 06 — Limites ilustrativos da Mesa

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/mesa-operacoes`, saldo fictício de R$ 100.000.
- **Ação:** tentar capital de R$ 6.000; depois testar quantidade 0 ou fracionária. Por fim, retornar a capital R$ 1.000 e quantidade 1.
- **Esperado:** a primeira tentativa é bloqueada pelo limite ilustrativo de 5% da Mesa, e as quantidades inválidas são recusadas. Tentativas recusadas não acrescentam intenções.
- **Limite:** essa barreira da Mesa é diferente dos parâmetros do laboratório de replay. Não presumir um único limite universal de produção.
- **Evidência:** mensagens de bloqueio, contagens do diário e parâmetros efetivamente usados.

### 07 — Diário, pausa e ausência de resultado financeiro presumido

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** Dashboard, Mesa e Sala de Controle, mesma aba/identidade.
- **Ação:** navegar após os cenários anteriores e comparar diário, saldo fictício e pausa. Observar a apresentação de bloqueios e de prejuízo evitado.
- **Esperado:** coerência dos registros locais e ausência de dinheiro ou lucro atribuído aos bloqueios. Sem evidência de execução verificada, não apresentar PnL real, acurácia real ou perdas reais evitadas.
- **Evidência:** telas e contagens comparadas. Não usar **Limpar diário** como pré-condição de aprovação.

### 08 — Análise de amostra e invalidação de resultado antigo

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** **Estudo do momento e estratégias**, presente em Dashboard/Mesa.
- **Ação:** importar uma amostra histórica local válida de 60–500 candles OHLCV, ordenados; clicar **Analisar amostra**. Depois alterar a amostra ou o horizonte.
- **Esperado:** indicadores e auditoria de qualidade identificam a amostra como histórica. A alteração de entrada/horizonte limpa a análise ou replay anterior, evitando resultado associado a parâmetros diferentes.
- **Evidência:** identificação e hash do arquivo de entrada, número de candles, parâmetros e comportamento após a alteração. Não é necessário consultar fonte pública ao vivo.

### 09 — Replay educativo dos três modos B80

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** laboratório, seção **Três modos — apenas roteiro de estudo**.
- **Ação:** com amostra válida, sessão não pausada e limites fictícios válidos, escolher **Direto**, **Reverso** ou **Híbrido · comparação de cenários**; executar o replay hipotético e repetir com outro modo.
- **Esperado:** resultados identificados como hipotéticos, com custos e stops ilustrativos. A troca de modo limpa o resultado anterior. O laboratório não afirma usar o motor operacional protegido nem executar ordens.
- **Limite:** o Híbrido deste seletor não constitui integração ou aceitação do R57. Os resultados não alteram as métricas reais nulas do ledger.
- **Evidência:** amostra, modo, parâmetros e resultado apresentado com sua classificação de hipótese.

### 10 — Honestidade da tela legada de Engenharia Reversa após a correção

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/engenharia-reversa`, no commit corrigido deste bloco.
- **Ação:** abrir a página e usar qualquer demonstração local que permanecer disponível.
- **Esperado:** ausência de histórico financeiro inventado, valor monetário fixo de ganho ou alegação de execução instantânea. O botão Adicionar exemplo ilustrativo deve acrescentar somente um exemplo local, sem análise de mercado, sinal ou ordem. Os exemplos devem desaparecer ao recarregar; esta tela não avalia megatendência nem confiança.
- **Limite:** se a correção for apenas de texto/rotulagem, isso não deve ser registrado como integração funcional do R58. Registrar exatamente o que a correção executa.
- **Evidência:** commit, texto inicial, resultado da interação e estado das métricas reais. O problema da base está descrito separadamente abaixo.

### 11 — Honestidade da tela de Risco após a correção

**Estado inicial:** `NOT_EXECUTED`.

- **Onde:** `/risco`, no commit corrigido deste bloco.
- **Ação:** alterar os valores do rascunho e clicar Revisar parâmetros nesta tela. Editar novamente um campo e verificar que a confirmação é retirada; recarregar a página para confirmar o descarte do rascunho.
- **Esperado:** a confirmação deve dizer que o rascunho foi revisado somente nesta tela, sem proteção ativada ou envio à corretora. Não há persistência de parâmetros; a recarga volta aos valores iniciais.
- **Evidência:** valor antes/depois, mensagem exibida, comportamento após recarga e mecanismo de persistência efetivamente implementado.

### 12 — Avisos R56 no fluxo do operador

**Estado inicial:** `BLOCKED_INTEGRATION`.

- **Objetivo:** demonstrar que o fluxo da interface utiliza `evaluateR56ManualAdvisory` ou uma integração equivalente rastreável ao comportamento certificado.
- **Cenários de laboratório já definidos:** condição tranquila sem intervenção; quatro perdas consecutivas, drawdown de 6R, baixa confiança e pedido de ajuda geram avisos, mantendo `automaticModeSwitch`, `automaticEntry` e `automaticExit` falsos.
- **Critério para desbloquear:** identificar a entrada dos dados, o vínculo da interface ao módulo e a forma de exibir avisos sem converter intenções locais em perdas verificadas.
- **Evidência necessária:** commit da integração, origem dos dados, saída do módulo e ação observada na interface. Executar a função offline, isoladamente, valida somente o caso de laboratório.

### 13 — Guard R57 e reversão seletiva R58 integrados

**Estado inicial:** `BLOCKED_INTEGRATION`.

- **Objetivo:** demonstrar os comportamentos do Híbrido e Reverso no caminho de homologação do produto.
- **Casos mínimos:** lados alinhados não geram intervenção; discordância com confiança 0,82 pode gerar orientação; confiança 0,60 não permite intervenção; megatendência impede inversão; losseshômetro permanece identificado como sintético quando a entrada for sintética.
- **Critério para desbloquear:** existir um fluxo de homologação que ligue dados identificados aos módulos correspondentes e apresente decisão/abstenção ao operador. O seletor B80 e o diário `reversa` não atendem a esse critério.
- **Evidência necessária:** origem dos sinais e confiança, limiar 0,65, saída das funções, comportamento da UI e ausência de transporte externo. Não interpretar o limiar como taxa de acerto.

### 14 — Fluxo de homologação do UltraFast

**Estado inicial:** `BLOCKED_INTEGRATION`.

- **Objetivo:** validar a experiência de selecionar ativo, capital, alavancagem e sessão, além de pausa e comunicação dos bloqueios de segurança, sem ordens externas.
- **Critério para desbloquear:** localizar ou implementar um fluxo de homologação claramente identificado, vinculado aos módulos existentes e às permissões de plano. A existência de `ultrafast-entitlement.mjs` isoladamente não demonstra esse fluxo.
- **Esperado após desbloqueio:** dados de teste rotulados, decisões e bloqueios rastreáveis, nenhuma alegação de milhares de operações reais, nenhum PnL real presumido e ausência de taxa por operação da plataforma conforme a regra definida.
- **Evidência necessária:** commit, tela/rota, entradas, entitlement, decisões, pausas, motivo dos bloqueios e comprovante de que o transporte externo continua desabilitado.

## Problemas constatados na base, separados da aceitação pós-correção

Esta seção registra achados de código em `f7dd8f4…`. Não afirma que o usuário encontrou esses problemas em uma sessão de navegador nem que a produção está servindo esse commit.

| Arquivo da base | Achado | Correção cuja aceitação é exigida |
|---|---|---|
| `app/engenharia-reversa/page.js` | Histórico inicial e temporizador produziam alegações fixas de lucro, preservação de capital e inversão instantânea; sem chamada a R58. | Remover as falsas confirmações e identificar corretamente qualquer demonstração local. Cenário 10. |
| `app/risco/page.js` | A ação somente alterava estado temporário, mas confirmava atualização na infraestrutura e prometia efeitos de motor. | Descrever o alcance real da configuração e de sua persistência. Cenário 11. |

## Pontos de ligação que ainda precisam ser demonstrados

Referências de linhas abaixo correspondem à base auditada; alterações posteriores podem deslocá-las.

| Referência | Evidência da base | Trabalho de integração necessário |
|---|---|---|
| `app/mesa-operacoes/page.js`, função `alterarModo`, linhas 58–61 | Aceita somente `manual` e `reversa`. | Definir e demonstrar o caminho do Híbrido operacional sem confundi-lo com o replay B80. |
| `app/mesa-operacoes/page.js`, função `executarOrdem`, linhas 141–153 | Valida parâmetros e grava uma intenção local; não chama R56/R57/R58. | Acrescentar/adaptar, em bloco próprio de homologação, a ligação rastreável entre contexto verificado, políticas existentes e apresentação ao operador. |
| `lib/platform/simulation-journal.mjs`, `appendSimIntention` | Normaliza COMPRA/VENDA e preserva `executed:false`, `verified:false`. | Manter essas classificações; não tratar diário do navegador como prova de trade ou loss. |
| `app/components/platform/PlatformStrategyLab.js`, imports e seletor de modo | Usa módulos de estudo/replay e `simulationModeLabels` de B80. | Manter o laboratório educativo separado da comprovação de integração dos robôs certificados. |
| `lib/platform/research/robot-r56-manual-final-advisory.mjs` | Função pura existente com regras de aviso. | Identificar produtor de entradas e consumidor da saída na homologação do produto. |
| `lib/platform/research/robot-r57-hybrid-final-alignment.mjs` | Bateria determinística que reutiliza `operatorAlignmentGuard`. | Identificar origem de contexto/confiança e integração do guard com o fluxo do operador. |
| `lib/platform/research/robot-r58-reverse-final-stress.mjs` | Função pura existente para reversão seletiva e métricas sintéticas. | Demonstrar ligação à UI sem habilitar transportes reais ou fabricar evidência prospectiva. |
| `lib/platform/ultrafast-entitlement.mjs` | Define planos permitidos para a funcionalidade. | Demonstrar UI de sessão, validação de entitlement e coordenação dos módulos técnicos existentes. |
| `app/components/platform/PlatformResearchReadiness.js` | Informa que os núcleos não foram instalados no runtime público. | Atualizar esse estado apenas quando a integração e sua evidência efetivamente existirem. |

## Registro obrigatório por execução

Para cada cenário efetivamente executado, preencher:

```text
ID do cenário:
Estado anterior:
Resultado: PASS / FAIL / NOT_EXECUTED / BLOCKED_INTEGRATION
Data e hora com fuso:
Responsável pela execução:
Commit e ambiente:
Rota ou comando de laboratório:
Identidade de teste identificada por apelido, sem credenciais:
Amostra/fixture e hash, quando aplicável:
Parâmetros usados:
Resultado observado:
Evidência anexada ou caminho do log:
Limitações e próximo passo:
```

Guardar somente a evidência necessária, sem senhas, tokens, dados bancários ou informações pessoais de terceiros. Capturas de tela devem ser produzidas no ambiente de teste e tratadas conforme o conteúdo que exibirem.

## Regra de fechamento

A certificação de pesquisa R12–R59 permanece preservada. Este guia só permite concluir a aceitação dos cenários realmente executados e documentados. Cenários `BLOCKED_INTEGRATION` impedem declarar os quatro robôs homologados de ponta a ponta na interface.

Manter `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` nulos enquanto não houver evidência própria e autorizada. Não preencher retroativamente o R15 nem converter resultados sintéticos em reais.
