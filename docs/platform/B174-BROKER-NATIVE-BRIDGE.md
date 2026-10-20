# JENIOS B174 — Conectores para as APIs oficiais das corretoras
Data: 20/10/2026. Base: B173 `cfc671b4ebc7b021549755edc6c6d072bcb134f3`.

## Modelo aprovado
**A JENIOS não cria nem substitui APIs de corretoras.** Cada cliente conserva sua conta na instituição e autoriza uma integração com a **API, OAuth ou terminal oficial** disponível. A JENIOS licencia o robô e apresenta a interface, mas não detém o dinheiro do cliente, não administra saques e não executa negociações por conta própria.

Fluxo: sessão autenticada Platform → escolha e autorização de corretora/conta → cofre cifrado por usuário → leitura da API oficial → núcleo original privado (direto/reverso/híbrido) → risco e reserva duráveis → adaptador nativo da corretora → recibos/fills/cancelamentos oficiais → reconciliação. Pausar e desconectar são ações diferentes de cancelar ordens ou encerrar posições.

As rotas internas `/api/platform/...` são somente fronteiras de autenticação entre o navegador e a tecnologia JENIOS; a contraparte da ordem é **sempre** o endpoint oficial do fornecedor (ou o terminal oficial contratado).

## Implementação neste checkpoint
- `nativeBrokerIntegrationPlan`: mapeia 12 fornecedores e seus meios de integração: Binance, Alpaca, Profit/Nelogica, Genial, Clear, XP, BTG, MT5, cTrader, IBKR, Mercado Bitcoin e Kraken. Não declara conexões que não existem.
- `nativeCustomerBinding`: usa a identidade Platform verificada pelo backend e o vínculo com a conta externa em nosso cofre. Rejeita troca de dono, revogação, ambientes Live e conectores não homologados.
- `strategyToNativePaperProposal`: os três modos geram propostas de ordens **no formato nativo Alpaca Paper** usando o B172 e o hash do núcleo original. Não reserva risco, não assina e não envia ordens.
- `lookupOwnAlpacaPaperOrder`: endpoint oficial GET `https://paper-api.alpaca.markets/v2/orders:by_client_order_id` para localizar a ordem por identificador do robô. Antes da consulta, a JENIOS revalida a conta externa e compara a referência cifrada/HMAC; falhas, 404 ou timeout bloqueiam qualquer reenvio automático.
- Página `/integracoes` agora afirma expressamente que conectamos **APIs oficiais**.
- Novos testes em CI para escopo de proprietário, rotas do fornecedor, três modos, estados parciais e reenvio proibido.

## O que ainda depende de homologação
Hoje Binance Spot Testnet e Alpaca Paper têm leitores GET implementados, mas não há conta externa autenticada comprovada. Os demais dez continuam sem conector operacional. MT5 e Profit podem exigir programas/terminais, cTrader exige registro OAuth e IBKR oferece modelos distintos com requisitos de terceiro. Nada disso é resolvido inventando uma API alternativa.

A ordem executora PAPER continuará desabilitada até: credencial de conta teste em canal protegido, prova de titularidade/escopo, reservas de risco persistentes e auditadas, confirmação de capacidade nativa de stop/proteção, teste prospectivo com recibo externo e recuperação pós-reinício. Dinheiro real exige uma autorização separada do operador.

### Fontes oficiais
- Alpaca order lookup: https://docs.alpaca.markets/us/reference/getorderbyclientorderid
- Alpaca order API: https://docs.alpaca.markets/us/reference/postorder
- cTrader OAuth: https://help.ctrader.com/open-api/account-authentication/
- IBKR third party: https://www.interactivebrokers.com/campus/ibkr-api-page/prospective-integrations/
