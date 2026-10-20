# JENIOS B175–B177 — Alpaca Paper no livro B152, sem transporte de ordens

Data: 20/10/2026. Branch de homologação derivada do B174 `4ed83bfb6de0d2805d54601268c7752c8827afdb`.

## O que já existia e foi reaproveitado

- B149–B154: núcleo original direto/reverso/híbrido **privado** e livro B152 SQLite para reservar risco e reconciliar eventos. As fontes originais privadas continuam somente na Biblioteca.
- B169: armazenamento cifrado da conexão e autenticação exclusiva da Platform. Não existe ainda piloto externo com credenciais verdadeiras.
- B172–B174: proposta de ordem nativa `bracket` Alpaca Paper sem envio, estados B173, recuperação por `client_order_id` usando GET da própria Alpaca.

## Novo trabalho efetivamente feito

**B175:** pequena extensão do validador de contratos B152 para a instituição `alpaca` somente ambiente `paper`, instrumento `spot` em USD e tamanho do contrato 1. A contabilidade do `PaperLedger` e cálculo de risco não foram reescritos. `alpacaPaperLedgerConnection` reaproveita o HMAC de conta e UUID do usuário verificado da Platform. `reserveAlpacaPaperProposal` verifica sessão, diagnóstico, identidade, sinal, modo, preço/contrato e permissões informadas por um serviço privado confiável, e reserva o risco SQLite antes de liberar **apenas uma proposta**, não uma ordem executável. Uma intenção duplicada não devolve proposta reenviável.

**B176:** reconciliação do retorno nativo de Alpaca Paper com o diário persistente B152. Um timeout, `404` ou estado desconhecido nunca é evidência de rejeição: preserva a reserva, bloqueia reenvio e exige revisão. Recuperação de `UNKNOWN` aceita somente informação externa confirmada. `PARTIAL` e cancelamento parcial preservam capital reservado até encerramento explícito. Nenhuma rotina transmite ordens ou libera posições em nome do cliente.

**B177-R2:** corrigido e testado o identificador estável da ligação: a reserva B152 deriva `ownershipConfirmedAtMs` da criação imutável `created_at` da conexão, não de `last_sync_at`, que muda a cada consulta. A primeira leitura pode ocorrer antes da inserção no banco, portanto não se exige que `last_sync_at >= created_at`. O teste força sincronização posterior seguida de reconciliação sem perder a identidade do ledger. O primeiro build preparado foi cancelado antes da promoção ao detectar a deriva.

**B177:** regressão cruzada, teste de reinício SQLite, isolamento entre usuários e proteção da base B174; Next.js e Social continuam intactos. Nenhum requisito de credencial, cobrança, migração, novo serviço ou infraestrutura foi introduzido.

## Limitações obrigatórias

1. A flag `JENIOS_PRIVATE_PAPER_REHEARSAL=true` é usada somente nos testes/worker privado QA; o código nega `VERCEL_ENV=production`. **Não configurar essa flag em produção.**
2. `source.serverVerified` e outros atributos de demonstração são contratos internos, **não prova criptográfica de autenticidade**. Um futuro worker deve gerar a evidência a partir de respostas oficiais e contexto de autenticação, nunca do JSON do navegador. A conexão de teste não está certificada.
3. O B152 reconhece ainda `ctrader` e `kraken-futures` exatamente como antes; a extensão Alpaca suporta a simulação conservadora de compras Spot, **não venda a descoberto nem contratos de futuros**.
4. O núcleo privado dos robôs **não é importado pelo frontend, repositório público ou Vercel**. Ordens reais e Paper continuam bloqueadas. A reserva de risco é uma operação local simulada que não substitui carteira real da corretora.
5. Para envio de ordens Paper faltam: conta autenticada de fornecedor em canal protegido, certificado de permissão/símbolo/stop e horário, worker privado de execução durável, aceites formais, transmissão e recibos externos, WebSocket/reconexão, testes prospectivos e avaliação independente.
6. Não ativar execução com dinheiro real sem autorização separada para corretora, mercado, conta, capital, perdas máximas e demais limites.

## Fontes das APIs oficiais

- Alpaca recuperação de ordem por ID do cliente: https://docs.alpaca.markets/us/reference/getorderbyclientorderid
- Alpaca Paper / gestão de ordens: https://docs.alpaca.markets/us/docs/paper-trading
- Documentação de Testnet Binance: https://developers.binance.com/en/docs/products/spot/testnet/rest-api
