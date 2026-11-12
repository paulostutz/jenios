# R103 — cancelamento privado Alpaca Paper e recuperação de preenchimentos incertos

## Problema e comportamento
Aceitar um pedido de cancelamento não significa que a ordem foi cancelada. Um preenchimento também pode ocorrer enquanto o pedido está em trânsito. A R103 implementa uma tentativa explícita de cancelamento de entrada Paper sem preenchimento, seguida de consulta ao broker, e preserva o risco enquanto o resultado não está confirmado.

## Implementação
- `cancelR103PrivatePaperOnce` recebe token Platform, conexão local, clientOrderId e confirmação específica. O titular vem do Auth; a conexão e o consentimento são lidos pelo serviço. Credenciais vêm do cofre existente.
- Consulta conta e ordem apenas em `paper-api.alpaca.markets`. Confere titular, identidade da conta, UUID externo, clientOrderId, símbolo, lado, quantidade, limite, tipo e classe bracket. Não aceita UUID externo ou proprietário indicados no pedido.
- Revalida consentimento e conexão antes da tentativa. Permite reduzir ordens de entrada com kill switch engajado sem desligá-lo. Recusa cancelar proteção de uma entrada já parcialmente/completamente preenchida.
- O B152 grava atomicamente a tentativa única e UNKNOWN antes do DELETE, no mesmo journal SQLite. O registro permanece após restart e backup/restauração, inclusive se o processo parar antes de efetuar a chamada. Não há retry automático.
- HTTP 204 é somente aceite. Consulta posterior da mesma ordem decide o estado. Timeout, 404, 422, 429, 5xx ou resposta inconsistente nunca significam cancelamento confirmado. A consulta pode confirmar cancelamento mesmo após a resposta do DELETE se perder.
- UNKNOWN agora conserva incrementos de quantidade executada. Uma confirmação posterior com preenchimento inferior ao já conhecido é rejeitada. Cancelamento parcial mantém a reserva de risco e exige revisão de posições/proteções.
- Uma opção explícita habilita o módulo somente no host privado de QA; web, produção, flags Live, emissor/execução de novas ordens e host inerte são recusados. O build web e o worker inerte também recusam a opção de cancelamento ligada.
- Não cria rota HTTP, cron, consumidor de fila nem chave; não altera bancos Supabase ou a estratégia original. O R77 de envio permanece inalterado.

## Verificação
Testes locais: 1.836 gerais aprovados e 94 Social/S05 aprovados. Build Next.js local compilado, com 81 páginas estáticas geradas; verificação local S05 aprovada. Cenários incluem comparação de contratos, consentimento revogado, concorrência, timeout, preenchimento durante cancelamento, respostas ambíguas, restart sem repetição, backup SQLite WAL e restauração do marcador de tentativa. O workflow está preparado para executar a bateria completa e o build. A publicação foi bloqueada pela revisão automática de aprovação por falta de autorização explícita para divulgar estas alterações no repositório público; o CI remoto desta etapa ainda não foi executado.

Os testes usam transporte simulado e credenciais sintéticas. Nenhuma chamada de corretora é executada nesta entrega. O módulo não está ativado; sua existência não certifica integração externa, adequação a Live ou lucratividade.

## Limites ainda abertos
Exige ensaio oficial em conta Paper autorizada, integração ao fluxo do operador privado e recibos externos. Permissões e restrições reais da conta precisam ser verificadas. Não encerra posições, não cancela legs após preenchimento, não faz cancelamento em massa e não implementa transporte Live. Corrida entre consulta e execução da ordem ainda exige reconciliação e revisão de proteção. Backup local testado não equivale a restauração offsite comprovada.

## Referências oficiais
- https://docs.alpaca.markets/us/reference/deleteorderbyorderid-1
- https://docs.alpaca.markets/us/docs/orders-at-alpaca

