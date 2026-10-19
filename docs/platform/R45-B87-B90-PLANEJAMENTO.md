# JENIOS Platform R45-B87–B90 — TradingView, mercado público e observações prospectivas

Escopo exclusivamente JENIOS Platform, projeto original `jenios-ecossistem`, sem alterações à Social, BankScore, Validador, PAY e robôs.

## B87 TradingView retrato e paisagem
Dashboard e Mesa usam widget TradingView comum (tv.js, autosize, sem operações). Vertical adapta à largura. Horizontal abre painel de tela cheia; em telefone travado em retrato, o gráfico é girado 90 graus.
Rotação física adapta o tamanho da janela. Modo Horizontal pode ser fechado por botão acessível e Escape. O gráfico de desktop mantém altura habitual. Chromium valida viewport 390×844 e 844×390.

## B88 Dados públicos
Endpoint GET `/api/platform/market-observation` obtém candles públicos Coinbase Exchange para BTC-USD, ETH-USD e SOL-USD, em 1, 5 e 60 minutos. Rejeita séries incompletas, velhas ou com lacunas. Os horários e a origem são exibidos ao usuário.
A Coinbase ressalta que candles históricos podem ter intervalos vazios e não devem ser consultados repetidamente como streaming. Nenhuma cotação preenchida artificialmente. Não há chaves de corretora nem ordem real.

## B89-B90 Observações futuras
O diário local por conta registra somente candles completos após consulta manual; recusa duplicados e retrocessos. Não monitora em segundo plano nem atribui retorno verificado.
O laboratório permite importar manualmente ou consultar a fonte pública, com testes de fonte e de qualidade. Editar a fonte limpa a alegação de origem anterior.

## Segurança e rollback
O modo de execução real permanecem desabilitados. Não foram criadas assinaturas nem cobranças, e o núcleo protegido é mantido sem alterações.
B86 continua ponto de rollback: commit `40ecfb5763283e6d5d399f746d9f037d27014977` e deployment `dpl_G3kuAsVJfu6WwBY6RYqJAGMJS8kR`.
CI integrada, 94 testes Social S05, build Next 15 e Chromium real são obrigatórios antes de deploy. Backups por checkpoint no GitHub e Biblioteca.