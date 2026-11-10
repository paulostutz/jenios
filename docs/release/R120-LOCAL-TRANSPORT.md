# R120: contrato de autenticação e transporte em ensaio local

**Não operacional. Não conecta conta, não envia ordens e não verifica autenticação na Binance.**

Este complemento exercita contratos REST em memória. Não é um cliente HTTP, não instala um assinador real e não conecta o executor R119 a um transporte autenticado. O fato de um cenário passar não autoriza usar dinheiro real nem demonstra proteção instalada.

## Entrega e fronteira

- `lib/platform/ultra/client/binance-auth-fixture-r120.mjs`: canonicalização, HMAC sintético, isolamento de produto, relógio fornecido pelo teste, classificação de respostas e circuito fechado a reenvios.
- `tests/platformUltraR120AuthFixture.test.mjs`: vetores determinísticos e testes negativos, sem rede.
- Os descritores, o journal e o adapter R119 permanecem inalterados. A classe nova não oferece o método `request` aceito pelo sandbox antigo nem modifica a autorização dele.
- Não há leitura de ambiente, chave do usuário, armazenamento de segredo, URL configurável, callback de transporte, HTTP, socket, temporizador ou criação de acesso persistente.
- Os sinais de resultado são sempre `fixtureOnly=true`, `nativeVerified=false`, `executable=false`, `ordersSent=0`, `automaticRetryAllowed=false` e `protectionInstalled=false`.

## API do ensaio

`new BinanceAuthFixtureR120({product, environment:'demo', clock:{serverTimeMs,monotonicMs}, responses})` aceita apenas `spot` ou `usds_m_futures` e dados declarativos. Um roteiro contém itens `{method,path,observation}`. A observação aceita `httpStatus`, `code`, `message`, `transportFailure` e `headers`, sem corpo de conta/ordem. Os três eventos de perda são `timeout`, `disconnect` e `response_lost`.

`simulate(descriptorR119,{monotonicMs})` recebe um descritor completo, não executável e não assinado. Confere schema, produto, rota e campos. Não altera o descritor original. Em Futures, o binding precisa ser exatamente o retornado por `binanceFixtureBindingR120('usds_m_futures')`; fingerprints de contas reais são rejeitados. O fingerprint sintético diferencia os produtos, mas não identifica usuário, conta ou UID Binance.

A saída padrão contém apenas resumo, timestamp, janela, binding sintético e rótulo de origem. `logs` usa uma allowlist: não guarda parâmetros, IDs, mensagens de erro, corpos, headers, chave, query ou assinatura. `status` expõe o circuito, quantidade de simulações e `ordersSent:0`.

`canonicalizeBinanceFixtureParamsR120(params)` ordena nomes conhecidos, preserva strings decimais/IDs sem arredondar e codifica os valores uma vez por RFC 3986. O ensaio usa todos os parâmetros na query, sem misturar query/body. Isso é uma escolha local determinística, não uma exigência de ordenação da REST Binance. A canonicalização não substitui a validação comercial de filtros, saldo, posição ou tipos de ordem.

`signBinanceFixtureR120(params)` é um auxiliar explícito de teste: calcula HMAC-SHA256 somente com a constante pública `JENIOS_R120_PUBLIC_SYNTHETIC_HMAC_NOT_AN_ACCOUNT`. Não recebe segredo, não produz header de autenticação e não conhece uma conta. Retorna bytes canônicos e assinatura sintética apenas para verificação de vetor. A saída desse auxiliar não deve ir para logs nem ser tratada como descritor executável.

## Relógio e repetição

- A âncora de servidor é um número fornecido pelo teste, não horário autenticado da Binance. O relógio monotônico também é fornecido explicitamente, sem callback.
- O tempo monotônico pode permanecer igual, mas não regredir. A âncora expira após cinco minutos. Somas fora da precisão inteira segura são rejeitadas.
- `recvWindow` é inteiro entre 1 e 5000 ms neste ensaio. Timestamp ausente é calculado da âncora; timestamp já presente não é renovado. Uma intenção antiga expira em vez de receber nova assinatura com tempo atualizado.
- Timestamps futuros são rejeitados, mesmo dentro da tolerância que a exchange eventualmente admita. A escolha local é mais restritiva.
- Após 429/418, autenticação/acesso inválido, relógio inválido, falha conhecida de serviço ou resultado incerto, o circuito fica travado. Não há reset, reconexão ou reenvio automático. Construir outra fixture inicia outro teste independente; não resolve a incerteza de uma ordem.
- O `Retry-After` REST é interpretado somente como segundos inteiros, até três dias. Valor ausente, malformado ou com formato de data não inventa um prazo. Mesmo um prazo válido não destrava o circuito.
- Contadores `X-MBX-USED-WEIGHT-*` e `X-MBX-ORDER-COUNT-*` são observados, mas sem teto conhecido não se calcula saldo de orçamento. `limitsVerified=false` e `remainingBudget=null` são explícitos.

## Resultado não é execução

`HTTP_ACK_ONLY` significa que o roteiro forneceu um status HTTP positivo, não que uma ordem foi aceita, executada ou protegida na exchange. Não há normalização de recibos neste componente.

`REJECTED_THIS_ATTEMPT` não prova que uma tentativa anterior deixou de executar. `UNKNOWN` cobre perdas, timeouts, respostas ambíguas, ausências e possíveis duplicatas. Todos exigem reconciliação e proíbem reenvio automático. Respostas 503 reconhecidas como falha em USDⓈ-M não são generalizadas para Spot. Redirecionamentos são recusados, nunca seguidos.

O journal R119 continua responsável pelo seu próprio ensaio durável; esta classe não cria operações, não grava evidência financeira e não fornece um atalho para promover fixtures a evidência nativa.

## Documentação oficial conferida em 10/11/2026

As URLs abaixo são referências documentais. Nenhuma conta ou endpoint de negociação foi chamado na verificação. Algumas rotas antigas da documentação redirecionam para as novas páginas oficiais.

### REST Spot

A [documentação REST Spot](https://developers.binance.com/en/docs/products/spot/rest-api) descreve HMAC/RSA/Ed25519, assinatura dos bytes codificados, timestamp, janela padrão de 5000 ms e máximo de 60000 ms. Spot admite precisão adicional que este ensaio intencionalmente não implementa. Também documenta que timeout pode deixar a execução desconhecida e que 429/418 exige recuo, com `Retry-After` em segundos. As taxas devem ser lidas do contrato vigente, não copiadas de exemplos como cotas universais.

A [referência oficial de tipos de chave](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/api_key_types.md) atualmente classifica HMAC como depreciado e recomenda chave assimétrica. O vetor HMAC R120 não é uma recomendação de criar nova credencial HMAC nem implementa migração de chaves.

### Ambientes e produto

O rótulo local `demo` de Spot aponta apenas para a referência `https://testnet.binance.vision`, documentada nas [instruções oficiais de Spot Testnet](https://developers.binance.com/zh-CN/docs/products/spot/testnet/web-socket-streams). **Spot Testnet não é tratado como equivalente ao produto Spot Demo Mode.** Nenhum dos dois é conectado aqui.

Para USDⓈ-M, a [referência geral oficial](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info) informa REST `https://demo-fapi.binance.com` e stream de teste `wss://demo-fstream.binance.com`. Produção usa `https://fapi.binance.com`, que não faz parte do roteamento desta fixture. A mesma referência distingue 503 com execução desconhecida de falha explícita de serviço e de sobrecarga `-1008`. Não se infere que todo 5xx possa ser reenviado.

### WebSocket não é REST com outro endereço

A [referência geral de Spot WebSocket API](https://developers.binance.com/en/docs/products/spot/web-socket-api) especifica teste em `wss://ws-api.testnet.binance.vision/ws-api/v3`, conexão de até 24 horas, ping a cada 20 segundos e resposta pong em até um minuto. Os limites e os payloads WS têm contrato próprio; `retryAfter` WS não é o header `Retry-After` REST.

A [referência de assinaturas e subscriptions Spot](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/ws-api/user-data-stream) diferencia `session.logon`/`userDataStream.subscribe`, que requerem sessão autenticada com Ed25519, de `userDataStream.subscribe.signature`, que usa uma assinatura por requisição. Portanto não existe neste trabalho um assinador WS universal e o HMAC REST sintético não demonstra sessão Ed25519 ou subscription autenticada.

A [referência de User Data Streams USDⓈ-M](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/user-data-streams) atualmente descreve produção em `wss://fstream.binance.com/private/ws/<listenKey>`, validade de 60 minutos para `listenKey`, renovação e desconexão em 24 horas. Essas sessões, seus tokens, keepalive e recuperação não são criados por R120. A referência de teste identifica o host demo, mas isso não é prova de que um caminho privado/assinatura funcionou naquele ambiente. Uma futura integração precisa confirmar o contrato específico do ambiente, reconstituir subscriptions e reconciliar lacunas, sem presumir que reconectar prova ausência de execução.

## Pendências para uma integração real, a cargo do operador

1. Selecionar produto, região, conta e ambiente elegíveis diretamente na plataforma oficial e conferir permissões e termos.
2. Usar um componente local específico para provisionar/configurar a credencial apropriada. R120 não oferece essa configuração. Chaves privadas, segredos, tokens e `listenKey` não devem ser colados no chat, enviados ao servidor do aplicativo ou incluídos em relatórios. Não habilitar saques para um componente de negociação.
3. Manter chave privada/segredo sob armazenamento local protegido, com escopo mínimo, associação explícita à conta/ambiente, rotação e revogação. O fingerprint desta fixture não valida nenhuma dessas condições.
4. Validar separadamente autenticação, sincronização de horário, limites reais, snapshots, recibos, subscriptions, reconciliação durável e custos. Testes offline e prova de uma única assinatura não substituem esses requisitos.
5. Conferir proteções, exposição, modo de posição e comportamento após falha com o operador responsável antes de qualquer operação. Não há botão, comando, variável de ambiente ou flag R120 que habilite execução real.

## Verificação local

Executar `node --test tests/platformUltraR120AuthFixture.test.mjs`. O vetor HMAC é fixado no teste e também conferido por implementação independente `hmac`/`hashlib` do Python. Os testes cobrem canonicalização, adulteração, bindings, timestamp/janela, clock, roteamento, perda, 429/418, 5xx, autenticação, redaction e ausência de acesso aos globais de rede.

Passar esses testes significa apenas conformidade com o contrato local acima. **Nenhuma validação nativa de Binance, conta real, ordem de teste remota ou negociação foi realizada.**
