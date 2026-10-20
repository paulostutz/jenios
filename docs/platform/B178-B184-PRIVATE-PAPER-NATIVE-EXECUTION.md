# JENIOS B178–B184 — ponte nativa Alpaca PAPER com bloqueios, laboratório e limites

**Data:** 2026-10-20. **Base:** B177-R3 `caaffece04649a6dc1ca6c8012d7502887771529`.
**Escopo:** somente JENIOS, sem tocar Social, PAY, BankScore, Universidade ou núcleos privados.
**O objetivo não é criar uma API concorrente; é utilizar `paper-api.alpaca.markets` na própria conta do cliente.**

## Desenvolvimento aditivo

- **B178:** diário SQLite local protegido `AlpacaPaperDispatchJournal`, com chave por UUID de proprietário/conexão/ordem; `prepare` e `claim` transacionais, uma tentativa de saída, retenção da ambiguidade e verificação de evidência para reconciliar. Não guarda credenciais. Reinício nunca libera outro disparo da mesma ordem.
- **B179:** comprovante técnico HMAC-SHA256 expira em no máximo dois minutos e vincula conta, identidade autenticada, payload, modo e revisão independente por operador humano. Flags de interface ou afirmações do cliente não são autorização. **Bloqueia qualquer runtime da Vercel** e exige processo privado explícito.
- **B180:** adaptador somente para `POST https://paper-api.alpaca.markets/v2/orders`, corpo nativo de ordem *bracket* com stop/alvo, limite de resposta e validação da ordem devolvida. HTTP 4xx, erro de rede ou JSON inesperado são ambíguos: não reenviar automaticamente. Não existe host Live.
- **B181:** orquestra o modelo original de proposta B174, a conta individual B165, a reserva B152, o diário B178 e a resposta B180. Credenciais são decriptadas de registro server-side; autenticação da conta é refeita via leitor oficial GET; o hash da conta deve continuar o mesmo; uma consulta server-role atualizada deve confirmar que o vínculo não foi revogado antes da tentativa. O núcleo proprietário não é carregado na aplicação pública; o worker privado será o emissor das decisões quando instalado e certificado.
- **B182 (somente Biblioteca privada):** repetido ensaio do núcleo original B154 com SHA imutável; estudo histórico adicional congelado sobre 5m/1h BTC, ETH e SOL, 2026Q3, sem otimizar parâmetros. 54 células de 3 modos × 3 custos × 2 variantes × 3 ativos. Intenções buy/sell **sintéticas**, resultados retrospectivos e simplificações de custos, sem conexão com contas de cliente. A maioria dos cenários é negativa. Isso é evidência de NÃO promover estratégia para dinheiro real; não é prova de desempenho econômico.
- **B183:** verificação read-only de pernas da ordem *bracket* via `GET /v2/orders/{id}?nested=true`, verificando lado oposto, alvo, stop, quantidade e grupo quando houver. Aceite de pedido não é aceite de proteção; pernas ausentes exigem revisão. Stops **não têm preço de execução garantido**.
- **B184:** CI com regressão ampla, preservação dos arquivos B177, browser smoke e verificações de que esses módulos não são importados por nenhuma rota HTTP de produção.

## Escopo e isolamento

O código é protocolo público/QA, sem segredos e sem o núcleo proprietário. **Não instala serviço worker persistente, não cria contas, não habilita campos de credenciais em produção e não envia ordens no ambiente real do fornecedor neste checkpoint.** O simulador usa stubs HTTP autenticados, nunca chaves reais.

Mesmo uma eventual chamada PAPER demanda todos os itens: sessão validada, conta ativa não revogada, digest de identidade externa conferido, autorização humana *Paper* de uso da conta, auditoria efetiva das permissões da chave pelo fornecedor, verificação de disponibilidade do instrumento, orçamento/riscos fixados no worker, consentimento, comprovante assinado, disponibilidade de processo privado fora da Vercel e continuidade da reconciliação. Faltam ainda licenças, mercado, telemetria, alertas, procedimentos de emergência e janela prospectiva.

**Pendências antes de autorizar qualquer piloto conectado:**
- Inserir no ambiente protegido, nunca no chat, uma conta Alpaca **Paper** válida e voluntária; validar operação com o usuário, permissões, produto, leitura atual, rotação/revogação e latência. Testes mocks não substituem essa evidência.
- Implantar worker privado isolado e durável com banco seguro, segredo e revisão operacional, controles contra duplicidade após falha, bloqueio de revogação e auditoria. A consulta pré-envio não constitui lock distribuído com a corretora; falhas e revogação concorrente continuam exigindo vigilância operacional.
- Homologar entrada e saída de ordens PAPER **somente após autorização separada de piloto**, com evidências reais de ACK, fills, cancelamento e pernas de proteção. Nenhuma alteração do núcleo original antes de estudo independente.
- Reavaliar dados OOS e depois estudo prospectivo; a amostra de sinais sintéticos não valida o desempenho comercial da tecnologia, e o cooldown de 60 minutos teve efeito nulo no estudo de oportunidades amostradas a cada 4h. Não prometer rendimento.
- Concluir as integrações próprias de cada corretora (cTrader OAuth, MT5 bridge, ProfitDLL/terminal, IBKR gateway, Binance Testnet com OCO validado). Não inferir homologação desses dez nomes a partir dos guias existentes.
- Dinheiro real é **NO_GO** até autorização explícita de contas, mercados, capital, riscos e revisão independente.

## Referências oficiais consultadas

- Alpaca `POST /v2/orders`: https://docs.alpaca.markets/us/reference/postorder
- Alpaca `GET /v2/orders:by_client_order_id`: https://docs.alpaca.markets/us/reference/getorderbyclientorderid
- Alpaca `GET /v2/orders/{order_id}?nested=true`: https://docs.alpaca.markets/us/reference/getorderbyorderid-1
- Brackets/legs: https://docs.alpaca.markets/us/docs/orders-at-alpaca
- Outubro/2026 group ID/role: https://docs.alpaca.markets/us/changelog/2026-10-08-order-group-db02af7
