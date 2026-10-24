# JENIOS — checkpoint de integração G45 + PR5/PR6 + proteção da Universidade

**Data:** 24/10/2026, horário de Brasília.

## Fonte integrada

- Base publicada anterior: `8d4936e0b02c39bb217ad542d01d330dc6cb71d6`.
- Fonte G45 certificada: `a82dca08e7847eabe3fb31f79a39de93c4c80a00`.
- Integração G45 sobre PR5/PR6: `def8a944e86ff7600b103e775239fa08a59ebc08`.
- Proteção posterior da Universidade: `04feb3a7988da5d280fa11f2fdcfafeab4f1ccb6`.
- Branch de certificação: `fix/jenios-g45-integrated-pr5-pr6-20261024`.
- Backup preventivo da produção anterior: `backup/jenios-g44-pr5-pr6-before-g45-20261024`.

## Regras aprovadas da G45

- Global Crypto: custo efetivo máximo de API de US$ 2 por ciclo; franquia interna equivalente a 4.000.000.000 nanoUSD.
- Internacional Pro: custo efetivo máximo de API de US$ 4 por ciclo; franquia interna equivalente a 8.000.000.000 nanoUSD.
- O aviso de 80% inclui consumo e reservas.
- Uma nova consulta avançada só pode começar se a reserva couber no saldo.
- Histórico e atendimento básico permanecem acessíveis após o esgotamento.
- Continuidade somente por adicional confirmado pelo cliente ou upgrade elegível; sem cobrança automática por excedente.
- Upgrade no mesmo ciclo preserva o uso e amplia o total uma única vez.
- Preço e tamanho comercial do adicional continuam sem aprovação e não podem ser inventados.

## Proteções preservadas

- PR5, experiência do cliente, e-mails, Banco Inter, memória e extrato Pro permanecem preservados.
- PR6 permanece obrigatória: credenciais bancárias não ativam pagamentos; criação de checkout, pedido ou Pix depende de `JENIOS_PAY_PAYMENTS_ENABLED=true`.
- O fluxo mensal da Universidade também respeita a pausa global de pagamentos antes de preparar novos pedidos, sem bloquear acesso já pago nem a leitura de pedidos existentes.
- Geração real de IA permanece desligada por padrão.
- Esta integração não autoriza pagamento, Pix, e-mail, ordem de negociação, consumo pago de IA ou promoção de domínio.

## Migração

Migração preparada: `20261024222440_jenios_pro_allowances_g45.sql`.

Antes de aplicá-la em banco hospedado, conferir o histórico oficial de migrações e a certificação integral da SHA combinada. A migração define franquias e reconcilia ciclos; não liga geração, pagamentos ou preços.

## Gate de conclusão

A SHA combinada deve passar por:

- verificação exata da base PR5, das alterações G45, do gate PR6 e da proteção da Universidade;
- regressão geral e S05;
- build Next;
- PostgreSQL descartável para memória G43, reparo/orçamento G44 e franquias G45;
- confirmação de que pagamentos e geração continuam desligados;
- backup certificado da mesma SHA.

Somente depois: conferir/aplicar a migração uma única vez, criar implantação Production sem domínio, testar a implantação exata e promover manualmente a mesma build aprovada.
