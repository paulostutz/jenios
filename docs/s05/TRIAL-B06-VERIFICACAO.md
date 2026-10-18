# S05-B06 — Teste grátis uma vez por pessoa: validação e bloqueios

Duração fixa: 7×24 horas = 168h. Uma identidade documental verificada (CPF), não um e-mail nem dispositivo, define concessão. CPF em texto claro não deve ser persistido no ledger; HMAC SHA-256 com segredo privado e revisão de privacidade/retencão.

A prova do provedor é obrigatória **no servidor**, vinculada ao usuário autenticado e com vencimento. O cliente não pode enviar `verified: true` nem um CPF de sua própria escolha para se tornar elegível. RPC PostgreSQL deve ser atômica, com unicidade de identidade e usuário e proteção por RLS e roles.

S05 fecha endereços internos/endereços IP na configuração do verificador para reduzir SSRF. Também preserva a dupla trava: `JENIOS_TRIAL_ENABLED=false`, `JENIOS_TRIAL_ACTIVATION_APPROVED=false` no laboratório. **Nenhuma concessão pública, chamada a verificador externo, pedido pago ou assinatura foi criada.**

Pendências: definir provedor verificado e contratos de dados, aprovação LGPD, migração jurídica de retenção, e2e autenticado contra fornecedor. O S05 não atribui porcentagem de conclusão de ativação do trial até validar essas dependências.
