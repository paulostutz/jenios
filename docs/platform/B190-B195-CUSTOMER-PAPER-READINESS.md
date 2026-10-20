# JENIOS Platform — B190–B195: conexão própria, riscos adversos e prontidão para homologação

Data de referência: 20/10/2026. Repositório exclusivo `paulostutz/jenios`.
Base pública certificada: **B189**, commit `bd33fdec24098f560ba786789d2ff495b96e2745`, CI `39510764146` **success**.
Produção deliberadamente preservada: **B177-R3** (`caaffece04649a6dc1ca6c8012d7502887771529`).

## Escopo realizado

- **B190 — cliente e corretora:** estado de ativação apenas informativo para as 12 instituições/guias existentes. Binance Spot Testnet e Alpaca Paper já têm fluxo protegido de leitura por usuário nos B165–B169; os outros dez continuam sendo guias ou integrações externas com terminal/permissões por validar. Um resumo de autorização mostra claramente que conta lida não equivale a permissão de negociação, comprovação civil de titularidade ou homologação Paper. O formulário de QA existente recebe melhoria incremental `details` com os passos necessários. Não cria novos campos de chave e não torna a tela disponível em produção.
- **B191 — procedimento de incidente:** leitura do **SQLite B152 real** por proprietário/conexão privada; apura reservas, preenchimentos e estados UNKNOWN/SUBMITTING/PARTIAL. O operador pode pausar entradas **localmente no ledger**, sem enviar cancelamento ou fechar posição no provedor. Requer ambiente privado e validação de sessão.
- **B192 — respostas adversas:** simulador determinístico, offline, com cinco cenários além dos seis de B185: ACK→timeout, parcial→timeout, ACK duplicado, rejeição posterior a execução e fill fora da ordem temporal. Executa sobre a tabela real de risco, com os três modos, preservando idempotência e reservas. Nenhuma chamada HTTP nem reenvio automático.
- **B193 — proteção:** gate de revisão de risco que cruza estado da operação com respostas de *bracket* já validadas pelo auditor B183. Mesmo quando as duas pernas aparecem em um mock, não afirma que stop executou, que proteção está ativa externamente ou que houve autenticação real.
- **B194 — avaliação do núcleo:** critérios conservadores de aceitação de resultados OOS e prospectivos por modo, ativo e custo; não retreina o núcleo e não altera qualquer parâmetro de negociação. Mantém os resultados do B182 como pesquisa: 2/9 cenários positivos a 0bps, 1/9 a 10bps, 1/9 a 30bps, com amostra prospectiva independente ainda faltante. Dados fornecidos pelo chamador não podem certificar por si mesmos a origem externa.
- **B195 — CI e integridade:** trava explícita do B189, valida mudanças aditivas e a pequena melhoria na UI de QA, regressão completa, teste de browser e exportação de evidências. O comportamento de produção continua sem endpoint de envio de ordens.

## Modelo do cliente

O cliente abre sua conta e autoriza sua própria corretora pelos meios e APIs oficiais. A JENIOS oferece tecnologia licenciada, monitoramento e adaptadores específicos; não cria uma corretora paralela, não guarda saldo financeiro, não custodia fundos, não permite saques. Chaves são inseridas **somente** no cofre da própria plataforma em ambiente seguro apropriado, nunca no chat.

### Estágios separados de prontidão

1. Guia e documentação oficial disponíveis.
2. Conta de teste vinculada por usuário e ambiente, com GET autenticado do fornecedor (implementado apenas em ambientes privados já preparados nos B165–B169).
3. Permissões específicas auditadas com o fornecedor (pendente).
4. Serviço worker persistente e isolado, credenciais rotacionáveis e procedimento de contingência (pendente de instalação externa).
5. Autorização separada de piloto Paper externo, verificação da ordem por `client_order_id`, eventos e duas pernas de proteção (pendente).
6. Dados prospectivos e resultados líquidos resistentes a custos/slippage/drawdown, com inspeção independente (pendente).
7. Negociação com dinheiro real: **NO_GO** sem autorização explícita separada, regulatória e de segurança.

## Critérios e limites para interpretar os testes

- Estes testes examinam fluxos sintéticos reais **dentro do SQLite B152**, sem testar uma operação transmitida à Alpaca ou a outra corretora.
- O uso de `source.serverVerified=true` em fixtures não prova autorização pelo provedor; serve apenas para exercitar estados do contrato privado.
- Modo reverso e híbrido compartilham a mesma reserva de risco B152, mas esta execução não valida a qualidade das decisões do motor proprietário. O B182 usou intenções sintéticas e apresentou resultados históricos majoritariamente negativos.
- `stop` e `take_profit` simulados não garantem preço, fill, ativação, proteção dinâmica nem posição encerrada.
- Acúmulo de exposição parcial, latência, taxas, funding, margem e liquidação só serão homologados quando houver amostras suficientes por mercado/contrato e corretora — nada aqui autoriza operar dinheiro real.

## Documento de interface/API atualizado

- `DemoBrokerConnector` em preview mostra passos faltantes após a consulta autenticada. Mantém máscara dos campos de teste e regras de cofre, sem qualquer token real no código.
- `b190-customer-activation.mjs` é **informativo**; suas propriedades `paperOrdersCertified`, `liveOrdersAllowed` e `realExecutionAuthorized` são sempre falsas. Informações digitadas no navegador não se tornam aprovação regulatória, de mercado ou de worker.
- `b191` e `b192` não estão importados por rota de produção. Somente processos privados podem utilizá-los em testagem.
- O catálogo oficial de doze provedores e os endpoints GET existentes foram mantidos, sem construir APIs substitutas.

## Fontes do fornecedor (contexto técnico, sem autenticação)

- Alpaca Trading API orders: https://docs.alpaca.markets/us/docs/orders-at-alpaca
- Alpaca GET orders `nested=true`: https://docs.alpaca.markets/us/reference/getallorders-1
- Alpaca grupo/leg roles, atualização 08/10/2026: https://docs.alpaca.markets/us/changelog/2026-10-08-order-group-db02af7
- Binance Spot Testnet: https://developers.binance.com/en/docs/products/spot/testnet/rest-api

## Proibições preservadas

Nenhum dinheiro real; nenhuma ordem Paper externa; nenhuma credencial em GitHub, biblioteca ou chat; nenhuma alteração Letter, Chefe, Social, Gênios, Universidade, BankScore, Validador ou JENIOS PAY; nenhum merge/deploy da branch de desenvolvimento para a produção original.
