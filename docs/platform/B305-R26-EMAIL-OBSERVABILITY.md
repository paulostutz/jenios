# B305-R26 — Telemetria e prontidão no painel Master

Base: R25 `7015c08e4021dc49b5687ca9139ed43a8027b88e`.

Ampliação somente leitura de `/admin/emails`:
- quantidade de complaints;
- quantidade de hard bounces;
- bounces transitórios;
- eventos de usuário não localizado;
- prontidão booleana das credenciais;
- estado do gate do webhook.

A API retorna somente booleanos de configuração:
- API do Resend configurada;
- acesso server-side ao Supabase configurado;
- CRON secret configurado;
- remetente Financeiro correto;
- domínio JENIOS verificado;
- signing secret do webhook configurado ou pendente.

Nenhum valor secreto é retornado.
Não há destinatários, IDs de evento, IDs do provedor ou controles de envio.

Todos os gates continuam desligados e produção permanece inalterada.
