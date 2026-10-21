# JENIOS B289 — Database QA checkpoint, 21/10/2026

**Base anterior** B288-R2 `581058b8195c75d941185dc028fff057110ab311`, CI `39652330064` SUCCESS, Vercel Preview READY `dpl_5icWQ7FK8k9q4VW9un5GyFZzjDo5`.

## Escopo aplicado (somente homologação)
- Supabase Social QA: `rebzztxlzofxpfwjvbee`.
- Estrutura JENIOS PAY replicada **somente como schema** da migração canônica já presente no repositório `20261012_jenios_pay_v1.sql`; não foram copiados usuários, pagamentos ou dados pessoais.
- Tabela `jenios_learning_state` replicada do schema R26, apenas QA.
- Permissões e RLS para objetos financeiros: somente leitura por usuário autenticado restrita pelas políticas existentes; gravações financeiras exclusivas de service_role. Webhook indisponível ao cliente.
- Três planos (99,90, 149,90 e 199,90) cadastrados como **inativos para contratação**, sem emissão de Pix nem criação de assinatura.
- Nenhum usuário QA foi criado porque os dois projetos de homologação ainda não possuem contas; não fabricar credenciais Auth ou inserir diretamente em `auth.users`.
- Estrutura original Social, Platform QA e produção permanecem preservadas.

## Critérios
Verificação SQL de RLS, GRANT/REVOKE, cinco tabelas financeiras e `jenios_learning_state`; catálogo com preços corretos e `active=false`. Verificação da rota /api/jenios-pay/products?scope=platform sem `paymentsEnabled` ou `checkoutReady`. A CI usa apenas QA local.

## Pendente
Sem contas reais, não há aceitação autenticada ponta a ponta. Banco Inter e comprovação Pix foram adiados a pedido do usuário. Não habilitar cobrança, IA paga nem ordens. Todo o trabalho fica separado dos projetos CHEFE e LETTER.
