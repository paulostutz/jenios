# JENIOS V7 — Checkpoint 07 / Gestão de cobranças

Data local: 14/10/2026. Base: Checkpoint 06, branch jenios-v7-homologacao.

## Decisões confirmadas pelo usuário nesta conversa

- Reutilizar integração Banco Inter/JENIOS PAY já validada pelo usuário; não reconstruí-la.
- BankScore detalhado: R$ 9,90. Validador detalhado: R$ 9,90.
- Platform: Nacional R$99,90, Global Crypto R$149,90, Internacional Pro R$199,90 mensais, checkout separado da Social.
- Impulsionamento: orçamento definido pelo cliente.
- Especialistas: comissão de 10%; não foi confirmada mensalidade fixa.
- Concluir código para posterior teste do usuário, preservando produção.

## Implementado neste bloco

- Painel /admin/cobrancas: preços, disponibilidade e últimas 100 cobranças reais da tabela existente.
- Autorização financeira validada no servidor por usuário Supabase e papel administrativo confiável; o login demonstrativo legado não concede permissão financeira.
- Cadastro/edição sem novas tabelas; detecção de alteração concorrente pelo updated_at. Preços anteriores de pedidos são preservados.
- Catálogo com valores aprovados e separação Social/Platform.
- Botões encaminham a contratação com sessão e chave idempotente. Sucesso não é simulado.
- Impulsionamento usa posts próprios reais, objetivo, região, orçamento diário e duração; total recalculado no servidor e autoria conferida.
- /social/cobrancas mostra pedidos da própria conta, com filtro de propriedade no servidor.
- Checkout Platform substitui a confirmação fictícia por encaminhamento à PAY.
- Adaptador isolado para a PAY existente: não altera Inter nem webhooks. Pedido persistido e reutilizado em retentativas, com validação de valor/moeda e redirecionamento.
- Compatibilidade de chave pública Supabase ampliada sem alterar cadastro/login existentes.

## Verificação

- npm test: 71 testes aprovados, 0 falhas (inclui simulações de persistência e gateway).
- npm run build: aprovado; páginas e APIs novas compiladas.
- Testes HTTP locais: 11 verificações (autorização, catálogos, páginas e redirecionamento) aprovadas.
- Sem execução de pagamento ou escrita remota no Supabase nesta etapa.
- Teste de navegador automatizado preparado, mas não executado: binário Chromium indisponível no ambiente. Testes HTTP locais não substituem essa homologação visual.

## Fronteira ainda não homologada

A URL e o contrato real do endpoint PAY instalado no Mac não estão disponíveis neste ambiente. O adaptador usa contrato explícito documentado em docs/JENIOS-PAY-CONEXAO.md e precisa ser compatibilizado com essa implementação. Configuração não é prova de compatibilidade testada. O catálogo inicial precisa ser salvo pelo admin autorizado na tabela existente antes de cobrar.

O usuário autoriza tratar a integração bancária como validada por ele; não se deve transformar isso em alegação de teste bancário realizado pelo assistente. Nenhum webhook novo foi criado ou serviço bancário substituído.

## Ainda pendente na V7 completa

- Compatibilizar adaptador com o endpoint existente e testar retorno/entrega por pagamento.
- Concessão paga de laudos por consulta, execução de campanhas, ofertas/contratação/repasses de especialistas.
- Laudo BankScore completo com balanços oficiais complementares e autenticidade avançada de tokens.
- Armazenamento remoto de vídeos, navegador e Vercel Preview.

Este é backup de continuidade com código consolidado, não pacote final homologado. Não instalar em produção como release final.
