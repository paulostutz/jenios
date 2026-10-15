# Revisão R16 — Lives compartilhadas

Lives agora usam /api/social/lives e a tabela lives. Cadastro autenticado, título até 120 caracteres, ID YouTube validado, remoção pelo proprietário, lista de 50 itens por página e busca entre itens carregados. Duplicidade por proprietário e vídeo é impedida no banco. O status efetivo da transmissão continua sendo definido pelo YouTube.

Denúncias de Lives chegam à tabela reports. Moderadores podem ocultar e restaurar transmissões com justificativa, auditoria e controle de concorrência. Bloqueios entre contas restringem a visibilidade de Lives. Alterações locais antigas não são importadas automaticamente: não possuem propriedade confiável para atribuir a uma conta.

Migração aplicada: 20261015172828_social_lives_moderation.sql. Não foram criadas transmissões ou denúncias reais nos testes. A transmissão nativa não está incluída nesta etapa.

Validação: 251 testes unitários; compilação de produção; testes PostgreSQL isolados de bloqueio, moderação, auditoria e revogação de acesso; regressão de navegador com contas e HTTP simulados; verificação de acesso sem sessão aos endpoints. Ver logs em evidencias-r16.

A publicação na Vercel e a homologação com contas reais continuam pendentes. O Gmail escolhido para moderação ainda precisa corresponder a uma conta cadastrada antes da atribuição do papel. E-mails institucionais adiados por decisão do usuário.

O teste de Lives usa autenticação e HTTP simulados; o script de preparação foi ajustado para não acessar localStorage dentro de iframes externos. As execuções intermediárias de QA foram substituídas pelos logs finais.
