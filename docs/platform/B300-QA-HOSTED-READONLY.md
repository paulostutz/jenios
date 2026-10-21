# JENIOS B300 QA — Evidência HTTP externa somente leitura, preservando produção
Data: 21/10/2026. Branch: fix/jenios-b300qa-hosted-preview-readonly-evidence-20261021. Base B299-QA: 58d7fa5f4c5aaf13ebae6a714b975c74e08af752, CI 39691820156 SUCCESS.

## Evidência de origem e segurança
- Preview fixo, de um commit antigo B293 (não B298 integrado): `https://jenios-ecossistem-9dgnjtals-jenios.vercel.app`.
- Deployment Vercel `dpl_7KdTFayDHEbVnZSEUCHg2pRN55BN`, READY em inspeção prévia, SHA `b44d43a4fa6ff6249d61bf8b257b1a64105be33d`. Não confundir com a produção B177-R3 ou declarar B299 hospedado.
- A branch B300 e suas antecessoras B298/B299-QA têm deploy Git explicitamente bloqueado via `vercel.json`.
- Backup pré-bloco: `backup/jenios-b300qa-pre-hosted-preview-58d7fa5f-20261021`.
- Nenhuma credencial, payload de usuário, cookie ou autorização chega ao verificador. Todos os requests são GET, com URL exata e no máximo um por rota, sem redirecionamentos automáticos.

## Gate remoto independente
`scripts/platform/b300-qa-hosted-readonly.mjs` verifica dez páginas públicas, quatro APIs privadas que devem responder HTTP 401, o Gênio gratuito e os catálogos Platform/Social. Todos os catálogos devem manter pagamentos/checkout desligados; três planos Platform e a Universidade devem ficar inativos. Um catálogo que se diz configurado pelo backend NÃO equivale por si só à prova SQL independente da ligação ao banco QA.

Se Vercel bloquear o acesso com SSO/proteção, houver falha de rede, resposta privada inesperada, cobrança ativa ou dados inconsistentes, o gate retorna NO_GO e não faz bypass. Teste executado pelo GitHub Actions em job separado do CI local. Não habilitar automação paga para contornar proteção.

## Base SQL já conferida read-only
- Supabase Platform QA `xaicvhagftzjkqphnbgx`: zero usuários Auth e zero diagnósticos no momento da auditoria. Cinco tabelas administrativas com RLS habilitada, sem SELECT/INSERT/UPDATE direto para `authenticated` ou SELECT para `anon`; `service_role` possui leitura.
- Social QA `rebzztxlzofxpfwjvbee`: zero usuários, pedidos e pagamentos. Tabelas privadas de PAY, Inter, progresso de cursos e mensalidades com RLS ativa; sem INSERT/UPDATE por cliente.
- Policies financeiras SELECT de pedidos, assinaturas e benefícios por titular, pagamentos por pedido do titular e produtos por estado ativo.
- Zero contas de QA impede afirmação de Auth E2E ou sessões multiusuário reais. O script CP69 existente precisa de `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` exclusivo de QA, credencial ausente do inventário da branch Preview. Não inventar ou copiar produção; inserir somente no ambiente privado apropriado pelo operador.
- Quatro funções SECURITY DEFINER da Social ainda sob revisão intencional; não revogar ou abrir grants indiscriminadamente.

## Critério de status
- Certificável automaticamente: teste puro de URL pinned, zero mutações, proteção 401, catálogo inativo, CI offline, build, e eventual resposta HTTP real GET da versão B293.
- Não certificável sem acesso: catálogo QA hospedado se o HTTP remoto falhar, login/sessão com usuários QA, integração Banco Inter/mTLS/Pix, corretoras oficiais, IA paga, modelo de risco com ordens reais, performance/lossômetro realizado.
- Produção só altera com aprovação explícita do proprietário. Conservar backups e relatório no checkpoint B300.
