# JENIOS B76 — Perfil, Menu 3 Pontos e Direct (19/10/2026)

Escopo exclusivamente JENIOS Social integrada à Platform. B74 em produção preservado no deployment dpl_F5fP5HJGQvoeK1b5qd9BhsGwSSFg.
Base B75 comprovada em CI: c933bcc8607084ce0c34200d0ff9be566ba12dcd. Backup: backup/jenios-b75-pre-profile-direct-b76-20261019.
Branch isolada: fix/jenios-b76-perfil-publico-direct-mobile-20261019.

## Navegação
- Celular: um botão recolhido de três pontos, abre menu por toque/teclado. Desktop preserva navegação principal.
- O botão Feed global virou Acesso Público. Feed pessoal é a grade dentro do perfil, por autor.
- Cabeçalho simplificado para Sala de Controle, Notificações e Sair. Sem @ duplicado, Reels e Destaques fora do perfil.
- Reels, Destaques, Arquivados, Usuários Bloqueados, Lives, Editar Perfil e Meus Insights agrupados exclusivamente quando id do perfil visitado corresponde ao usuário autenticado.
- Perfis visitados nunca recebem Arquivados, Bloqueados, Edição nem Insights do dono. Destaques públicos do autor continuam disponíveis conforme RLS.

## Publicações
- Postagens são armazenadas pela API existente na tabela public.posts com author_id validado no servidor e mídia persistida.
- Feed pessoal recupera publicações do autor da rota existente /api/social/profiles, mesmo após reload, paginando além de vinte.
- Arquivar usa archived_at; o autor pode desarquivar, e a grade pública não mostra arquivados.
- Exclusão permanece ligada à autenticação e à condição author_id do banco, com confirmação na UI.
- A navegação de perfil neste bloco ainda utiliza os requisitos de sessão Social preexistentes; a publicação anônima deve ser revisada separadamente, com RLS apropriada, se desejada.

## Direct
- Único acionador no canto inferior direito; ao abrir, a inbox mostra conversas existentes.
- Para iniciar conversa, entrar no perfil público da pessoa e escolher Enviar Mensagem.
- Serviço original de mensagens, RPC de abertura, verificação de identidade e transmissão preservados.
- Busca pesada e sistema localStorage falso de mensagens removidos da tela, sem migrações de banco.
- Polling continua habilitado somente enquanto a conversa estiver aberta; sem contador falso de mensagens não lidas.

## Segurança e saída
- Nenhuma API financeira, JENIOS PAY, cobrança, Supabase isolado da Platform ou robô foi alterado.
- Não promover antes de CI, build Next 15, Chromium mobile, backups, verificação de domínio e rollback.
