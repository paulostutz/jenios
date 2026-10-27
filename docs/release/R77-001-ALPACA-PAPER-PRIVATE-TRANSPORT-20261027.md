# JENIOS R77 — Transporte privado de ordem Alpaca PAPER (sem Live)
Data: 27/10/2026. Base imutável: R76 \`7ef18860276e220041c89b7a6094eeae6c856e72\`.

## Objetivo preservando os backups
A JENIOS fornece robôs e conecta cada usuário à **própria conta de corretora** por API oficial. Não recebe o capital, não faz saques, não administra custódia e não inventa APIs alternativas. B149–B154 já construíram o livro persistente de risco SQLite; B165–B169 entregaram leitor de conta e cofre individual; B172–B177 entregaram proposta bracket, hash do núcleo original e reconciliação após falhas. R74 instalou o núcleo privado verificado por hash, ainda restrito a ciclos sintéticos. R75/R76 recuperaram o painel administrativo e seu healthcheck sem ordens.

**Não refazer esses blocos nem alterar engine/service.** O R77 acrescenta exclusivamente o componente faltante de *transporte privado controlado* para **Alpaca PAPER** e cenários de teste.

## Código entregue
- \`lib/platform/connections/alpaca-paper-private-transport-r77.mjs\` — biblioteca para worker privado isolado, nunca rota HTTP. Endereço de destino fixo: \`https://paper-api.alpaca.markets/v2/orders\`, que é o endereço oficial de PAPER. Nunca usa o host de negociação real.
- Reaproveita \`readDemoBroker\` B166 para contas/posições/ordens, \`digestDemoAccount\` B169 para vínculo criptográfico a usuário e conta, B175/B152 para reserva de risco e B173 para recibo. Consulta adicional GET em \`/v2/account\`, \`/v2/assets/{symbol}\` e \`/v2/clock\` para verificar bloqueio de conta, disponibilidade do ativo e mercado aberto. Somente ações de compra Spot de ações dos EUA, **quantidade inteira e ordem bracket**, com stop e alvo.
- Exige identidade da Platform validada pelo worker, autorização PAPER explícita recente amarrada ao usuário/conexão, teto de notional especificado em unidades, orçamento de risco durável já configurado e leitura válida da conta com digest correspondente. Testes internos de autorização usam objetos sintéticos; o worker operacional futuro precisa obter consentimento autenticamente verificado em registro confiável — um JSON fornecido pelo cliente não é prova.
- Emite evento durável \`SUBMITTING\` **antes** de qualquer POST; para um \`client_order_id\` gera no máximo **uma tentativa**. Se houver timeout, HTTP não conclusivo ou recibo inválido, preserva o risco e o estado \`UNKNOWN\` ou \`SUBMITTING\`, bloqueando reenvio automático. A reconciliação B176 existente é responsável por consultar a ordem pelo identificador antes de qualquer resolução manual.
- Nunca envia ordens de corretora real, saque, transferência ou liquidação. Não inclui novas APIs públicas, credenciais ou UI de botões de enviar.
- Gates isolados: \`VERCEL_ENV=preview\`, \`JENIOS_PRIVATE_PAPER_REHEARSAL=true\`, \`JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED=true\`, \`JENIOS_PRIVATE_PAPER_EXECUTOR=true\` e \`JENIOS_REAL_EXECUTION_ENABLED=false\`. Essas flags são **somente para execução autorizada em worker isolado**, não para Vercel de produção. Os 20 controles da Preview pública permanecem \`false\` e o teste injetará flags fictícias em memória.
- Não habilitar as flags de PAPER no site. Não executar nem mesmo Paper externo sem conta autenticada e limites aprovados.

## Verificações
A suíte \`tests/platformRobotR77AlpacaPrivateTransport.test.mjs\` simula respostas das APIs oficiais e exige:
1. Falha fechada em produção, Live, flags ausentes e consentimento vencido.
2. Verificação individual de conta/status/trading_blocked, ativo e mercado, nenhuma requisição POST em falhas.
3. Conexão e digest do proprietário; rejeição de outra conta e limites extrapolados.
4. Envio único bracket PAPER em resposta simulada, evento persistente ACK.
5. Após reset de conexão, rejeição HTTP, recibo inválido ou duplicata concorrente: UNKNOWN sem segunda ordem e risco ainda reservado.
6. Regressões B152/B169/B174/B176/R75/R76, Next.js build, 94 testes Social e validação das versões G49/G48/M02.
7. CI e zip de evidência com \`include-hidden-files=true\`, corrigindo o problema de arquivamento visto na R76 sem reescrever a R76.

## Acesso móvel
O app M02 atual é contêiner WebView/PWA sem assinatura de loja comprovada. Não copiar nenhuma credencial de corretora para ele. A página \`/integracoes\` pode orientar o cliente, mas o **conector executor** é exclusivamente servidor privado. Publicar a biblioteca no projeto e manter flags desligadas não coloca uma ordem no mercado nem cria nova versão assinada/TestFlight.

## Critérios reais de liberação ainda externos
- Conta voluntária Alpaca PAPER autenticada em canal protegido; consentimento e autorização verificados no servidor, com dados da corretora e mercado confirmados.
- Prova de execução PAPER com ordem de teste autorizada, recibo oficial, estados/fills/cancelamento/stop e recuperação após reinício do worker durável; revisão de isolamento e risco independente.
- Piloto Live por usuário/corretora com limites aprovados, adaptação do executor Live (ainda inexistente), retirada do NO_GO por análise de risco/conformidade aplicável e testes com a conta verdadeira, sem saques.
- iOS/Android: associação de \`br.com.jenios.app\` à conta oficial, assinatura separada, QA em aparelhos, conteúdo de pagamento conforme regras de loja, distribuição TestFlight/Google Play. O workflow M02 gerou *unsigned*, não IPA/AAB aprovadas.

**Nenhuma dessas etapas externas pode ser falsamente declarada concluída pelo CI sintético.**

## Backups e rollback
Fonte R77 em GitHub PR contra \`release/jenios-genios-g44-20261024\`, manifest de hashes Git congelado, base R76 \`7ef1886\`, domínio G49/R76 preservado. Rollback da web para \`dpl_GJQumEvUXs1nbQ3Tse3KBj2H5ez6\`. Nenhum dado de cliente/Supabase, núcleo privado, credencial, cobrança, posição ou ordem foi tocado nesta preparação.
