# JENIOS B171–B173 — conexões e ensaio privado de ordens Paper

Data: 20/10/2026. Base certificada: B170 `1174cb6bdc97f0eaa8294896d1ac836ae4c96db3`.

## Resultado técnico

B171: mapa tipado dos 12 guias existentes. Distingue API REST, OAuth, terminal Windows/DLL, terminal MT5 e Client Portal/fornecedor aprovado. A rota anônima `GET /api/platform/broker-readiness` retorna **apenas metadados**, sem receber chaves, fazer consultas a corretoras ou solicitar permissões.

B172: elaborador local de proposta de ordem LIMIT **Alpaca Paper / ações**, com payload bracket de take profit/stop loss; requer modo direto/reverso/híbrido, referência esperada do núcleo original, associação de conta Paper, revisão do sinal e controles de fonte. O retorno **sempre** contém `canSubmit=false`, `sent=false`, `ledgerRiskReserved=false`, `brokerBracketSupportVerified=false`, pois o livro de risco B152 não está conectado a um serviço operacional durável dessa corretora. Envio de ordem demonstrativa e real **bloqueado**; Binance Spot ainda depende de validação de proteção atômica para a estratégia antes de preparar execução.

B173: normalizador local de eventos Alpaca Paper e estados desconhecidos. Diferencia ACK, PARTIAL, FILLED, CANCELLED, REJECTED e UNKNOWN com validação de conta, símbolo, client_order_id e quantidade. Não libera risco automaticamente; um cancelamento parcial exige conferência e mantém a exposição relevante. Timeout/reinício não provoca reenvio automático. Não interpreta desaparecimento de ordem como fill.

O núcleo proprietário original foi recuperado **somente em ambiente privado**, verificado pelos SHA-256 certificados e ensaiado nos três modos com o mesmo livro B152. A evidência privada fica **somente na Biblioteca privada**, nunca neste repositório público, no deploy, em logs de navegador ou em backups públicos.

## Requisitos reais que permanecem

- Binance Testnet e Alpaca Paper: credenciais oficiais de teste inseridas em QA protegido, isolamento da conta, permissões realmente conferidas, teste HTTP autenticado e reconciliação da conta.
- Alpaca Paper: comprovar suporte à ordem bracket por instrumento e capacidades reais da conta; só depois de ledger durável e autorização explícita será possível implementar/ativar POST Paper sob trava por usuário, risco e idempotência.
- Binance Spot Testnet: não executar ordem desprotegida; validar stops/OCO e consistência dos eventos antes de liberar transporte Paper.
- cTrader: app/redirect registrados, OAuth 2.0 accounts primeiro; permissão `trading` separada; o host demo é diferente do live.
- IBKR: usuário individual pode precisar Client Portal Gateway/TWS; integrações de terceiros dependem da modalidade autorizada. Não presumir OAuth público disponível a qualquer aplicação.
- Mercado Bitcoin: OAuth2 client_credentials documentado; não há sandbox autenticado homologado no projeto.
- Profit/Nelogica, Genial/Clear/XP/BTG: confirmar licenças e roteamento do ProfitDLL no Windows/broker. MT5 requer ponte terminal/EA com reconciliação.
- Kraken: confirmar produto, ambiente de teste e credenciais adequados; guia e draft não equivalem a API ativa.

## Segurança

Não há novo endpoint de envio de ordens, conexão financeira, credenciais ou pagamentos. Não há alteração em Social, PAY, BankScore, Validador, Pro, Universidade, robôs privados ou banco Supabase. Produção B170 não muda com este bloco. Dados de contas reais e qualquer operação com capital dependem de autorização e evidências separadas.

### Fontes oficiais
- https://docs.alpaca.markets/us/v1.1/reference/postorder
- https://help.ctrader.com/open-api/account-authentication/
- https://help.ctrader.com/open-api/proxies-endpoints/
- https://api.mercadobitcoin.net/api/v4/docs
- https://www.interactivebrokers.com/docs/web-api/getting-started
