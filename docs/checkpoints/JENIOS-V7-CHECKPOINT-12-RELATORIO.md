# JENIOS Social V7 — checkpoint 12 — 14/10/2026 (Bahia)

Base remota d644fdd142adcc5a8b96f9baab2364ce209c6032, árvore 2ed287ff4927b2cc0e6d8bc2de50ee4aa5924825. Branch jenios-v7-homologacao; produção e main preservadas.

## Implementado e verificado localmente

- Campanha de impulsionamento ligada 1:1 ao pedido PAY, com público/objetivo/destino e orçamento/duração imutáveis após contratação. Orçamento continua escolhido pelo cliente e recalculado no servidor.
- Preparação da campanha antes do checkout quando a extensão está ativa. Falha da estrutura ou chave de assinatura ausente não abre checkout; retentativa mantém pedido/campanha sem duplicar.
- Gestão /impulsionar/campanhas: ativação após paid, pausa, retomada e cancelamento da distribuição. Ações transacionais com titular/revisão/pagamento; não alteram registros financeiros.
- Distribuição interna opcional no feed original e no compartilhado, em componente rotulado Patrocinado. Visitante solicita anúncios e informa voluntariamente país/região/cidade. Nada de GPS/IP inferido, redes externas ou alcance garantido. Orçamento diário pondera seleção, não corresponde a débito por clique/exibição.
- Exclui campanha vencida/pausada, pedido não pago/reembolsado, autoria divergente, post apagado, bloqueios nos dois sentidos e o próprio anunciante. Releitura final do post/perfil no contexto RLS do visitante.
- Destinos seguros: perfil real em página somente leitura; site/copy HTTPS; WhatsApp wa.me com número e DDI. A navegação de perfil legada não foi substituída.
- Tokens de exibição assinados para campanha/conta/revisão, validade de 10 minutos. Eventos revalidam elegibilidade e deduplicam por conta/campanha/dia UTC. Contadores agregados, sem expor visitantes ao anunciante. São registros de uso, não auditoria antifraude completa.
- Cliente só tenta registrar impressão após 50% do cartão por 1 segundo em aba visível. Esta condição de navegador não foi homologada visualmente neste ambiente.

## Ativação pendente

Migração supabase/migrations/20261015001833_boost_campaign_delivery.sql criada com Supabase CLI 2.121.0, NÃO aplicada remotamente. O inventário consultado não tinha campanha/métricas equivalentes. Não duplica pagamentos: adiciona extensão de serviço e métricas. Não altera tabelas, referências ou webhooks PAY. Exclusão de post continua possível.

Configurar em homologação, somente no pacote final: JENIOS_BOOST_CAMPAIGNS_ENABLED=true, JENIOS_BOOST_SIGNING_SECRET aleatória própria de pelo menos 32 bytes e NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED=true. Sem flags, preservar comportamento anterior e não mostrar sucesso de campanha fictícia. Pedidos pagos anteriores à extensão não são importados automaticamente.

## Testes

166 testes unitários/contrato/mock aprovados; 26 verificações PostgreSQL isoladas de campanhas; 33 verificações HTTP; build Next.js e git diff --check aprovados. Testes SQL executaram migração, permissões/RLS, ativação, pausa, retomada, vencimento, segmentação, bloqueios, exclusão de post, deduplicação e preservação de registros financeiros de fixture. Não são teste remoto de carga ou concorrência multiconexão. Nenhuma cobrança ou alteração remota de dados foi executada.

## Auditoria remota de segurança — preexistente

Advisors consultado antes de fechar a migração. As novas estruturas ainda não estão na instância remota; não interpretar este resultado como auditoria delas em produção.

- INFO: RLS sem políticas em jenios_bankscore_homologacao, jenios_pay_webhook_events e post_views. Isso bloqueia acessos sujeitos a RLS por padrão; não conceder acesso amplo para remover o aviso. Avaliar o uso específico de cada tabela. [Orientação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- WARN: public.rls_auto_enable() SECURITY DEFINER tem EXECUTE para anon e authenticated. A inspeção mostrou retorno event_trigger e uso em DDL; não foi demonstrada exploração via RPC. Rever privilégios sem desativar a automação de RLS. Nenhuma alteração automática aplicada. [Anônimos](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- WARN: proteção contra senhas vazadas desativada no Auth. Avaliar ativação no projeto sem reconstruir o login já testado. [Orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Estes avisos permanecem para revisão antes da produção; não alegar segurança integral homologada. Não houve mudança de permissões ou configurações remotas.

## Pendências reais

- Instalação/homologação paga real de campanhas e atendimentos; configuração do adaptador para a PAY do Mac. Inter considerado validado pelo usuário e não reconstruído.
- Política de retenção/limpeza de eventos de anúncios, moderação publicitária e testes de carga/antifraude não implementados neste bloco. Segmentação textual autodeclarada, sem normalização de siglas ou localização verificada. Pausas não estendem prazo; cancelamentos não geram reembolso.
- BankScore: dados complementares para laudo completo e entrega paga; indicador prudencial provisório não é rating global.
- Platform: recorrência/liberação por assinatura ativa em checkout separado ainda pendentes neste ambiente.
- Especialistas: ativar migração do checkpoint 11; notificações, repasses e resolução financeira de recusas não concluídos.
- Validador: fluxo detalhado limitado do checkpoint 10; sem inventário completo de tokens e sem homologação paga real.
- Configurações de feed/mídia do checkpoint 08 e avisos de segurança acima ainda pendentes de homologação/gestão.

Backup consolidado com relatório de continuidade, não patch de instalação e não release final. Próximo bloco: BankScore e consolidação das pendências restantes, sem reabrir a integração bancária.
