# JENIOS B185 — Simulador de execução ponta a ponta

Base certificada: B184-R2, commit ba64c9b200af311477c592299cd5e4e61600e75b.
Escopo: homologação privada. Não é um conector de produção e não envia ordens reais.

## Contrato de aceite do simulador
- Identidade do usuário, conta Paper e permissão segregadas por cliente.
- Decisões dos modos direto, reverso e híbrido não podem contornar o mesmo livro B152.
- Reserva de risco anterior à transmissão; uma tentativa por client_order_id.
- Respostas simuladas de aceite, rejeição, execução parcial, execução total e timeout.
- Timeout conserva o estado desconhecido e bloqueia reenvio automático.
- Reabertura do diário após reinício conserva intenções e reservas.
- Stop e alvo só são marcados como confirmados após leitura independente das duas pernas.
- Falha de proteção exige revisão; não implica execução garantida.
- Taxas, slippage, latência e dados fora da amostra devem constar nos relatórios.
- Resultado econômico líquido, drawdown, taxa de acerto e robustez por período devem ser reportados, inclusive resultados negativos.

## Bloqueios
Credenciais externas somente pelo cofre protegido; nenhuma chave pelo chat.
Nenhum POST real, mesmo Paper, é autorizado por esta documentação.
Nenhuma mudança em produção antes de CI e regressões verdes.
Não substituir o núcleo original com base em ganhos históricos isolados.

## Critérios de lançamento
O simulador testa nossa implementação, mas não comprova autenticação ou execução externa. Um piloto Paper autenticado e aprovação independente de segurança são necessários antes de anunciar conexão operacional certificada.
