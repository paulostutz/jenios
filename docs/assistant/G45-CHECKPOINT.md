# JENIOS — checkpoint G45 integrado, banco aplicado e gate de publicação hospedada

**Data:** 24/10/2026, horário de Brasília.

## Fonte integrada e preservação

- Base publicada anterior: `8d4936e0b02c39bb217ad542d01d330dc6cb71d6`.
- Fonte G45 certificada: `a82dca08e7847eabe3fb31f79a39de93c4c80a00`.
- Integração G45 sobre PR5/PR6: `def8a944e86ff7600b103e775239fa08a59ebc08`.
- Proteção posterior da Universidade: `04feb3a7988da5d280fa11f2fdcfafeab4f1ccb6`.
- Primeira SHA combinada certificada: `cbd528d66ae82b19ac3ddf0b0584babb505eede1`.
- Branch de certificação/publicação manual: `fix/jenios-g45-integrated-pr5-pr6-20261024`.
- Backup preventivo da produção anterior: `backup/jenios-g44-pr5-pr6-before-g45-20261024`.
- Produção anterior preservada durante a preparação: deployment `dpl_EQTnuxKZmHboQhw4VHsic69G9prY`.

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
- PR6 permanece obrigatória: credenciais bancárias não ativam pagamentos; checkout, pedido e Pix dependem de `JENIOS_PAY_PAYMENTS_ENABLED=true`.
- O fluxo mensal da Universidade respeita a pausa global de pagamentos antes de preparar novos pedidos, sem bloquear acesso já pago nem leitura de pedidos existentes.
- Geração real de IA permanece desligada por padrão.
- Esta integração não autoriza pagamento, Pix, e-mail, ordem de negociação ou consumo pago de IA.

## Banco final

A migração de fonte `20261024222440_jenios_pro_allowances_g45.sql` foi aplicada uma única vez no projeto Social/PAY de produção e registrada no histórico hospedado como:

`20261024235145_jenios_pro_allowances_g45`

A validação posterior confirmou:

- franquias de 4.000.000.000 e 8.000.000.000 nanoUSD;
- `generation_enabled=false`;
- `payments_enabled=false`;
- `pricing_approved=false`;
- zero períodos Pro, consumo, reservas, pedidos, pagamentos, cotações, e-mails ou solicitações de IA criados pela migração;
- funções G45 sem execução para `anon` ou `authenticated`, mantendo acesso de servidor.

Não reaplicar essa migração.

## Certificação anterior e implantação segura

A CI `40144067815` certificou a SHA `cbd528d66ae82b19ac3ddf0b0584babb505eede1`, incluindo regressão geral, S05, build e quatro suítes PostgreSQL descartáveis. O backup da mesma SHA foi conferido.

A primeira implantação preparada, `dpl_BaS7iucyCaKUTg3BMfz3jHVJMLSZ`, clonou a SHA exata e falhou com segurança antes da compilação por `S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED`. O gate reconhecia somente a branch histórica G44. Os domínios permaneceram no deployment anterior e nenhum efeito externo ocorreu.

A correção de publicação adiciona somente a branch exata `fix/jenios-g45-integrated-pr5-pr6-20261024` à lista fechada de branches autorizadas. Variantes de data, branches vizinhas e nomes não revisados continuam rejeitados. Os testes específicos do escopo hospedado foram ampliados para comprovar essa fronteira.

## Gate de conclusão atualizado

A nova SHA deve passar por:

- verificação exata dos 1.019 arquivos da base PR5 e das alterações revisadas de G45, PR6, Universidade e gate de branch hospedado;
- regressão geral e S05;
- build Next;
- PostgreSQL descartável para memória G43, reparo/orçamento G44 e franquias G45;
- confirmação de pagamentos e geração desligados;
- backup certificado da mesma SHA;
- implantação Production preparada sem atribuição automática de domínios;
- testes HTTP da implantação exata;
- promoção manual da mesma build aprovada e verificação posterior dos domínios.
