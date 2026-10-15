# Checkpoint interno 16 — Hub espelhado na Social

Pedido explícito: espelhar o Hub na Social. Extraído o conteúdo de /tendencias para app/components/TrendsHub.js; a página pública e a aba interna da Social passam a usar o mesmo componente, fontes, critérios do radar, estados de indisponibilidade e avisos de limite. Nenhuma cópia independente de regras ou endpoints.

Social: atalho de serviços abre aba tendencias sem sair da página; navegação interna também inclui Hub de Tendências. Renderização condicional monta o Hub somente na aba selecionada, desmontando/cancelando consultas ao sair. Carregamento dinâmico evita incluir o módulo no caminho inicial do feed. Mantidas navegação de feed, perfil e demais serviços. Componente embutido usa section e h2; página isolada mantém main e h1. Nenhuma alteração de auth, posts, banco ou produção.

194 testes automatizados aprovados; verificação de concorrência/estado antigo foi direcionada ao componente extraído. git diff --check, build Next.js e 37 verificações HTTP aprovados. QA visual de navegador continua pendente conforme checkpoint 14; estes testes não comprovam cliques/renderização hidratada da aba. Não é entrega final; permanecem os limites de tokens novos/institucionais do checkpoint 15 e demais dependências anteriores. Nenhum pacote provisório entregue.
