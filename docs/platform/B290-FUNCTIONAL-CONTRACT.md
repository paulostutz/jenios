# JENIOS B290 — Inversão funcional e emissão de sinais: teste de contrato, não do núcleo

O modelo B290 testa comandos de **operador de referência autorizado**: abrir compra -> proposta de venda; abrir venda -> proposta de compra. Na presença de megatendência, a decisão acompanha a direção indicada pela pesquisa ou veta inversão automática. Cancelar e fechar não podem abrir exposição contrária. O contrato não executa ordens.

Manual e Híbrido: valida que um sinal fornecido por um chamador foi emitido, registrado e entregue antes da abertura do candle-alvo. Isso é um **teste de contrato com dados sintéticos**, não prova de que a plataforma emitiu ou entregou sinais de verdade.

Não atribuir a instituições específicas a contratação de iniciantes para perder. Internalização B-Book é prática de gestão de risco/execução em corretoras, não prova de estratégia lucrativa por inversão. Não usar informações privadas de operadores sem autorização.

## O que ainda falta para comprovar funcionalidade real
1. Acesso autenticado somente leitura aos eventos de sinal dos três núcleos privados e suas versões SHA.
2. Eventos reais de operador de referência com autorização, lado, horário, cancelamento, fechamento, duplicidade e rejeição.
3. Teste integrado com o roteador original, controles de risco B152 e entrega de sinais; conferir resultado recebido e não só a transformação isolada.
4. Replay determinístico e testes adversariais em homologação; sem transmitir ordem real ou Paper.
5. Relatório por evento com esperado versus obtido e evidência verificável.

Este B290 não altera o core, não valida lucratividade e não autoriza deploy ou cobranças.
