# JENIOS Platform — B231–B250: candidato para aceite de lançamento sem ativação financeira

**Base certificada e preservada:** B230 `162b256ecebfb7895aa1ca1e4256c93df938a9a0`, CI 39527691673 (success). **Data:** 21/10/2026.

## Mudanças efetivas

Este bloco contém somente módulos aditivos, testes, uma página estática de aceitação de homologação e pipeline. Nenhum código original do B230, do núcleo privado dos robôs ou das conexões/pagamentos existentes foi reescrito. **O teste verde não constitui homologação bancária, instalação de worker, aprovação de ordens, desempenho econômico ou publicação da produção.**

| Checkpoint | Entrega e limite de certificação |
| --- | --- |
| B231 | Matriz de aceite público exige CI, build, browser e preservação, mas sempre exige aceite independente do responsável |
| B232 | Página `/platform/homologacao` estritamente Preview e com flag server-only; conteúdo público informativo, não dados privados |
| B233 | Leitura offline de rotas: rejeita qualquer endpoint público de envio de ordens |
| B234 | Testes dos gates público/Preview e da presença de rotas proibidas |
| B235 | Conferência do catálogo com preços BRL 99,90 / 149,90 / 199,90, sem transação |
| B236 | Auditoria do ciclo de assinatura com a máquina de estados sintética B86 já existente |
| B237 | Teste do fluxo original de identidade verificada e uso único do teste gratuito de sete dias, com provedor/DB simulados |
| B238 | Vínculo entre pagador e usuário Platform não vira autorização de cobrança ou criação de perfil |
| B239 | Preflight integrado da infraestrutura privada real B213 e contrato de saúde B212; não instala servidor |
| B240 | Casos negativos de banco SQLite duplicado ou aberto com permissões inseguras |
| B241 | Estado de conexão a partir do vínculo individual do servidor; leitura não vira trading |
| B242 | Contratos reais de leitores B166 testados com respostas locais: Alpaca Paper e Binance Spot Testnet, só GET |
| B243 | Revogação local e ordens desaparecidas nunca significam cancelamento, fill ou revogação no fornecedor |
| B244 | Três modos exercitados no livro de risco SQLite B152, com teto de risco compartilhado |
| B245 | Fills fora de ordem e execução parcial com timeout bloqueiam reenvio e retêm risco |
| B246 | Comparação de pesquisa B182: resultados históricos, mesmo positivos, não certificam lucratividade |
| B247 | Auditabilidade prospectiva local: rejeita lookahead, duplicidade e timestamps futuros; testemunha externa pendente |
| B248 | Decisão segregada: público candidato, comercial NO_GO, Paper NO_GO, Live NO_GO |
| B249 | Relatório offline reproduzível, redigido sem segredos e com SHA de integridade que **não** é assinatura |
| B250 | CI integral, congelamento B230, proteção de rotas, regressão Social/Gênios/Universidade, artefatos e roteiro de aceite |

## Homologação antes da publicação

1. **Interface:** testar na sessão autenticada real e em dispositivos móveis a navegação, recuperação de acesso, dashboard, simulador, Universidade, Social, Gênios e perfil; checklist e aceite humano. A página Preview nova contém **somente status informativo** e não substitui o teste autenticado.
2. **Assinaturas:** um gateway de testes configurado por canal seguro deve reproduzir Pix, idempotência, vínculo do pagador, confirmação de pagamento, ativação, renovação, suspensão, cancelamento, estorno e antifraude. Não emitir nenhuma cobrança real até autorização explícita.
3. **Corretoras:** provisionar Linux privado JENIOS, chaves em cofre, três bancos SQLite duráveis, backup cifrado e alertas. Autenticar conta voluntária Alpaca Paper/Testnet, executar GET com permissão real de leitura. Não admitir credenciais no chat. Transmissão de ordens Paper exige aceite separado.
4. **Robôs:** confrontar os três modos no núcleo proprietário congelado com dados testemunhados e custos reais/spread/slippage/drawdown. O estudo B182 não demonstrou vantagem econômica robusta. Simulações de B244–B245 não garantem lucro.
5. **Release:** uma CI verde permite preparar um candidato em branch e Preview. Não autoriza fazer merge ou promover `jenios.com.br`. Revisar origem, backups, compatibilidade e rollback antes de publicar **somente** as funções homologadas.

## Política de execução e custos

- Produção de referência: `jenios-ecossistem`, B177-R3 commit `caaffece04649a6dc1ca6c8012d7502887771529`.
- Social, Gênios Pro, Universidade, BankScore, Validador, JENIOS PAY, código proprietário, Letter e Chefe foram preservados.
- Não há novas permissões para dinheiro real, depósitos, custódia, PIX, chamadas comerciais de produção, POST de corretoras nem compra de infraestrutura.
- Os métodos oficiais de GET existentes permanecem desligados na produção não homologada.
- A aprovação do bloco B231–B250 autoriza desenvolvimento, testes internos e preparação de versão; não confere homologação externa.

## Fontes técnicas de provedores já utilizados, não substituídos

- Alpaca Trading API Paper `GET /v2/orders:by_client_order_id`: https://docs.alpaca.markets/us/v1.4.2/reference/getorderbyclientorderid
- Binance Spot Testnet official endpoints: https://github.com/binance/binance-spot-api-docs/blob/master/testnet/general-info.md

## Distinção do relatório final

- **Construído**: código, testes, página Preview desativada por padrão, CLI e gates.
- **Testado**: somente fixtures e testes locais/CI; navegador localhost sem conta real.
- **Homologado externamente**: não; exige autenticação, provider, operador e dados reais.
- **Publicado na produção**: não; a versão B177-R3 não deve ser substituída por código não aceito.
