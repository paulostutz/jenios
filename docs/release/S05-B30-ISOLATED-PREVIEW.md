# S05-B30 — Prévia de release com isolamento verificado
18/10/2026 · JENIOS (somente JENIOS)

## Escopo e segurança
- Branch: `release/jenios-s05-integrada-homologacao-20261018` (não fazer merge na `main`).
- O ambiente **Preview desta branch, e somente desta branch**, recebeu variáveis apontando ao Supabase **isolado** `rebzztxlzofxpfwjvbee`.
- A origem das variáveis foi a branch S05 previamente homologada. Valores sensíveis não constam no repositório.
- Variáveis Supabase: URLs pública e servidor; chaves publishable/anon; chaves servidor exclusivamente de homologação.
- `NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO=false`, `JENIOS_TRIAL_ENABLED=false`, `JENIOS_TRIAL_ACTIVATION_APPROVED=false`.
- Não foram copiados certificados ou segredos Banco Inter, nem tokens/admin JENIOS PAY, para esta release.
- **Produção S02** `af86e69e5a0d5f344e89e2403210ff9fb5062315` e env de Production não alterados.

## Gates de publicação
- Consulta do @ anônimo deve responder 200 com disponibilidade real somente na prévia isolada; erro RPC 503 interrompe.
- Cadastro e confirmação de e-mail com identidades sintéticas aprovadas, feed com novo login e exclusão protegida; no uso de dados pessoais reais.
- Impedir pagamentos reais, chamadas do Banco Inter e trial; preservar APIs financeiras e núcleo B52.
- Privacidade: solicitação de exclusão apenas registra fila autenticada. Efetiva exclusão ainda exige processamento humano/compliance.
- Migração de produção em `supabase/release-review/` é **apenas proposta** e não foi aplicada.
- Não promover esta prévia de homologação diretamente a Production, pois suas variáveis de ambiente se referem ao banco isolado. O deployment Production exige build distinto com variáveis Production aprovadas e verificadas.

## Rollback
S02 `dpl_7vDVvGwfT6HKYf8n37EoBk9ccf24`.
