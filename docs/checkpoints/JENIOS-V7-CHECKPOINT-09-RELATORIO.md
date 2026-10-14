# JENIOS Social V7 — checkpoint 09 — 14/10/2026

Base: checkpoint 08, remoto 7772843b63761c69bbe39e810e46c6830cbfcc82. Somente branch jenios-v7-homologacao; produção e main preservadas.

## Concluído neste bloco

- Canonicalização única da contratação, compartilhada entre checkout e verificação de acesso, mantendo o formato das referências anteriores.
- POST /api/jenios-pay/access autentica a conta no servidor e consulta o pedido existente. Exige titular correto, estado paid, moeda/valor consistentes, produto e fingerprint da consulta/oferta correspondentes. Não altera pedidos, não confirma pagamentos e não chama Inter.
- Pagamentos pendentes, cancelados, expirados ou reembolsados são recusados. Referências antigas sem fingerprint não recebem liberação automática.
- Alteração posterior de preço/ativação do catálogo não revoga uma compra paga; usa valor original do pedido.
- Minhas cobranças oferece verificação da contratação paga. Dados da consulta ficam apenas no sessionStorage da conta, até o encerramento da sessão do navegador; não são divulgados na URL ou listagem de pedidos. Sem esses dados, o acesso não é presumido.
- Tela limpa resultados na mudança de sessão e ignora respostas assíncronas obsoletas.
- Retorno opcional ao site via JENIOS_APP_ORIGIN, definido no servidor. HTTPS e origem sem caminho. Social retorna a /social/cobrancas; Platform a /checkout. A PAY precisa aceitar o campo returnUrl do contrato do adaptador.

## Verificação

115 testes automatizados aprovados, incluindo autorização por conta/alvo, status financeiros, referência corrompida, preço histórico, Crypto, ofertas, orçamento e isolamento local. Build Next.js aprovado. Testes usam mocks; não houve cobrança real, confirmação manual, transferência ou alteração no Supabase remoto.

## Pendências e limites — não tratar como release final

- Endpoint de acesso é uma verificação reutilizável: ainda não está acoplado aos downloads detalhados, entrega da mentoria ou execução da campanha. A interface diz isso explicitamente. PDFs preliminares existentes permanecem como estavam.
- Retorno automático depende de JENIOS_APP_ORIGIN e compatibilidade do checkout PAY. Integração bancária é considerada validada pelo usuário; compatibilidade deste adaptador com a implementação do Mac não foi homologada neste ambiente.
- Assinaturas Platform não são liberadas por este endpoint: dependem de assinatura ativa, não apenas de pedido pago.
- BankScore segue sem balanços trimestrais completos; indicador prudencial preliminar não é rating de crédito completo.
- Mídia remota e feed compartilhado continuam opcionais e dependem da configuração documentada no checkpoint 08; nenhuma tabela/bucket foi criada.
- Homologação autenticada em navegador e ponta a ponta permanece pendente. Não houve acesso à produção.

Próximo bloco: conectar os consumidores à autorização e ao ciclo de entrega, mantendo separação entre pagamento, autorização e execução. Não reconstruir Inter ou webhook.
