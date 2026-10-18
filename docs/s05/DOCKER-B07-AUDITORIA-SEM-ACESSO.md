# S05-B07 — Docker JENIOS, auditoria não invasiva

**O ambiente Docker local do proprietário NÃO foi inspecionado nesta sessão** e nenhum container, volume, rede, banco ou secret foi alterado.

## Contexto já estabelecido

- MacBook com Docker 29.8.2 e Supabase CLI 2.120.0 utilizados em homologação local.
- API Supabase local previamente informada: `http://127.0.0.1:54321`; Studio: `http://127.0.0.1:54323`. São serviços de loopback do computador do proprietário; não são acessíveis a partir deste ambiente remoto.
- Repositório de trabalho usado anteriormente: `~/Projetos-JENIOS/JENIOS-V7-PACOTE-UNICO-AUDITORIA-20261013`.
- O projeto atual de homologação remota está **separado**: Supabase `rebzztxlzofxpfwjvbee`, e as variáveis da Vercel estão vinculadas somente à branch S05.

## Inventário necessário antes de qualquer escolha de infraestrutura

1. `docker compose ps` / `npx supabase status` no MacBook, com segredos e chaves removidos do resultado.
2. Versionar SQL de migrações e testar restauração em banco de testes, sem copiar PII de produção.
3. Verificar roles Postgres, RLS, Storage buckets, Auth, SMTP sandbox, backups, Rotação JWT e logs de auditoria.
4. Testar uploads e vídeos com data fake e limite de 90s; validar variantes sem depender de caminho binário privado.
5. Comparar DDL e permissões de `jenios-social-homologacao` com stack local por diffs somente; nunca usar comando de reset no banco de produção.
6. Check de custos, suporte a WebSockets/Realtime, disponibilidade HTTPS e persistência antes de migrar.

## Decisão desta etapa

Docker **continua alternativa**, não houve migração, novo serviço pago ou modificações no MacBook. Não se pode afirmar que o Docker hospede a JENIOS em produção sem auditoria dos serviços efetivos.
