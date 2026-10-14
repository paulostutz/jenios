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

## Validador

O catálogo de identidade cobre apenas endereços de referência USDT/USDC explicitamente cadastrados, conferidos nas fontes dos emissores em 14/10/2026. Não é uma varredura de todos os tokens de uma carteira. Um ativo fora do catálogo fica inconclusivo, não é automaticamente chamado de falso.

O RPC EVM deve informar a rede selecionada. Nome e símbolo são autodeclarados; a comparação usa endereço e rede. Um match no catálogo sem consulta on-chain bem-sucedida é mostrado como rede não confirmada.

O PDF é gerado no servidor com paginação. A cópia de revisão usada para inspeção visual foi uma amostra sintética, não laudo de transação real.

## Execução técnica

- npm test: testes unitários, de contrato e simulações; não substituem integração real.
- npm run build: compilação Next.js.
- node scripts/test-finance-http.mjs: testes locais sem sessão, catálogos e respostas de APIs.
- node scripts/test-finance-ui.mjs: opcional, requer Playwright e Chromium instalados; o Chromium não está disponível neste ambiente.

## Aceite final ainda necessário

Testar com contas reais de homologação: autenticação existente, postagem entre contas, comentários, curtidas, mídia, publicação/revogação de currículo, oferta paga e retorno da PAY. Testar também BankScore com suas fontes financeiras complementares e o Hub com os provedores configurados.

Esta cópia é consolidada para homologação, não uma declaração de conclusão integral nem autorização de promoção à produção.
