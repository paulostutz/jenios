# JENIOS Social V7 — roteiro da cópia consolidada

## Antes de testar

Use uma cópia separada do projeto e credenciais do ambiente de homologação. Não substituir a produção. A integração bancária existente é preservada; o adaptador está documentado em JENIOS-PAY-CONEXAO.md.

O código Social usa as tabelas existentes posts, comments, post_likes, profiles e jenios_specialist_profiles. Não criar tabelas jenios_social_* para estas APIs.

## Mídia

O upload usa um bucket público destinado somente ao conteúdo público da Social. A configuração observada remotamente ainda não possui bucket; nada foi criado automaticamente.

Com as credenciais server-side já configuradas em um ambiente isolado, o comando explícito node scripts/setup-social-media.mjs cria apenas o bucket social-media se ele não existir. Se já existir, o script o preserva; se for privado, interrompe sem alterar a privacidade. Esse comando não faz parte de build, instalação ou deploy.

Para testar envio remoto pelo composer legado, definir NEXT_PUBLIC_SOCIAL_REMOTE_MEDIA_ENABLED=true antes do build. Sem essa flag, o comportamento local anterior permanece preservado. SOCIAL_MEDIA_BUCKET pode selecionar outro bucket já configurado com limites e tipos compatíveis.

Limites: até dez arquivos, fotos JPG/PNG/WebP até 10 MB, vídeos MP4/WebM/MOV até 50 MB e 90 segundos. A duração é lida no navegador; não é uma inspeção audiovisual server-side. O servidor confere usuário, pasta, MIME e tamanho real armazenado antes de aceitar a URL no fluxo normal. A flag não converte o feed legado em multiusuário.

O feed compartilhado de homologação está em /social/feed-compartilhado, habilitado por NEXT_PUBLIC_SOCIAL_SHARED_PREVIEW_ENABLED=true. Ele publica texto/mídia nas tabelas reais e preserva rascunho quando uma operação falha. O composer principal e o compartilhado continuam separados para não substituir silenciosamente o fluxo já testado no Mac.

## Especialistas

Abra /especialistas. O diretório só apresenta perfis com autorização explícita de publicação. Perfis antigos são privados por padrão. No editor, preencha currículo, YouTube, ofertas e preços; marque autorização se desejar publicar.

Para evitar migração ou nova tabela, o campo sobre existente mantém uma representação JSON versionada contendo apresentação, consentimento e ofertas. Texto legado continua sendo lido como apresentação privada. Não editar esse JSON manualmente; usar a tela.

Contratação usa a oferta salva no servidor, não o preço enviado pelo cliente. A comissão JENIOS é de 10%; valor e comissão são enviados à PAY. Isso não comprova divisão ou repasse efetivo pelo serviço bancário. Rentabilidade/credenciais não verificadas permanecem identificadas como tal.

### Atendimentos — checkpoint 11

Código e migração prontos para homologação, ainda não instalados no Supabase remoto. A migração adiciona apenas a extensão de serviços vinculada ao pedido PAY existente; não altera status financeiro ou webhook. Revisar em homologação a migração supabase/migrations/20261015000628_specialist_order_fulfillment.sql antes de ativar JENIOS_SPECIALIST_ORDERS_ENABLED=true. Não ativar a flag antes da instalação. Não é uma instrução para instalar este checkpoint isoladamente.

Com a extensão ativa, contratar uma oferta e verificar que aparece em /especialistas/atendimentos para comprador e vendedor. Antes de paid, ações bloqueadas. Depois de confirmação pela PAY, vendedor aceita, agenda sessão e registra entrega; comprador confirma recebimento. Tentar repetir uma ação de revisão antiga deve retornar conflito, sem sobrescrever a atualização anterior. Alterar a oferta pública não deve alterar o snapshot do atendimento.

Testar recusa com motivo: deve ficar recusado, mas não devolver dinheiro automaticamente. Reembolso registrado pela PAY deve bloquear novas ações. Outra conta não pode ver ou modificar o atendimento. Não confirmar pagamento manualmente pelo navegador para simular a PAY.

147 testes unitários/contrato/mock e 21 verificações PostgreSQL isoladas aprovados. O script scripts/test-specialist-postgres.mjs compila a migração em memória, executa transições e verifica RLS/privilégios. Usa PGlite 0.5.10 instalado fora do projeto; não cria dependência de produção. A variável JENIOS_PGLITE_MODULE deve apontar para o arquivo dist/index.js desse pacote. A conexão é local/WASM, sem credenciais Supabase. Não substitui ensaio de concorrência multiconexão ou homologação na instância real.

26 verificações HTTP e build Next.js aprovados. Sem homologação autenticada de navegador, sem execução de serviço real, sem convites/notificações e sem repasses neste ambiente.

## Validador

O catálogo de identidade cobre apenas endereços de referência USDT/USDC explicitamente cadastrados, conferidos nas fontes dos emissores em 14/10/2026. Não é uma varredura de todos os tokens de uma carteira. Um ativo fora do catálogo fica inconclusivo, não é automaticamente chamado de falso.

O RPC EVM deve informar a rede selecionada. Nome e símbolo são autodeclarados; a comparação usa endereço e rede. Um match no catálogo sem consulta on-chain bem-sucedida é mostrado como rede não confirmada.

O PDF é gerado no servidor com paginação. A cópia de revisão usada para inspeção visual foi uma amostra sintética, não laudo de transação real.

### Consulta detalhada paga — checkpoint 10

1. Contratar a consulta de R$9,90 com rede, tipo e identificador definidos. O produto precisa estar cadastrado e ativo no catálogo real. Nenhuma cobrança foi gerada durante estes testes locais.
2. Depois da confirmação pela PAY existente, abrir Minhas cobranças e selecionar Emitir consulta detalhada e PDF. O link também aparece no botão que iniciou o pedido.
3. Os dados da sessão anterior são preenchidos quando disponíveis. Caso contrário, informar exatamente o mesmo alvo. Não há reaproveitamento para outro identificador.
4. Emitir o relatório. O servidor consulta novamente a fonte depois de autorizar o pedido. Falha de provedor não gera um laudo e não exige outra compra.
5. Baixar o PDF. Uma nova leitura é feita e pode apresentar um estado mais recente.
6. Confirmar rejeição de outra conta, pedido pendente/reembolsado e alvo alterado. Não editar status no navegador nem confirmar pagamentos manualmente para testar.

O relatório inclui achados interpretados, evidências, metodologia e limitações. Não é uma varredura de todos os tokens da carteira nem auditoria de segurança. A consulta básica existente continua disponível. No checkpoint 10: 129 testes unitários/contrato/mock, 23 verificações HTTP, build e PDF sintético de duas páginas inspecionado. Homologação autenticada real ainda pendente.

## Execução técnica

- npm test: testes unitários, de contrato e simulações; não substituem integração real.
- npm run build: compilação Next.js.
- node scripts/test-finance-http.mjs: testes locais sem sessão, catálogos e respostas de APIs.
- node scripts/test-finance-ui.mjs: opcional, requer Playwright e Chromium instalados; o Chromium não está disponível neste ambiente.

## Aceite final ainda necessário

Testar com contas reais de homologação: autenticação existente, postagem entre contas, comentários, curtidas, mídia, publicação/revogação de currículo, oferta paga e retorno da PAY. Testar também BankScore com suas fontes financeiras complementares e o Hub com os provedores configurados.

Esta cópia é consolidada para homologação, não uma declaração de conclusão integral nem autorização de promoção à produção.
