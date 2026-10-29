# R109 — adaptador de protocolo ProfitDLL

Data: 28/10/2026 (America/Bahia). Base: `254eb6212390f034e9121ac5071be0abdb587cc5`.

Paulo solicitou concluir a implementação técnica das conexões. O caminho B3 foi
priorizado nesta revisão como proposta técnica; não foi escolhida uma corretora,
contratada licença ou autorizada operação financeira individual. Alpaca continua
opcional. Os quatro motores originais e suas certificações históricas foram preservados.

## Entrega

- Tradução de decisões finais Manual, Híbrido, Reverso e UltraFast para os campos
  documentados de `TConnectorSendOrder`: mercado, limitada e stop-limit.
- O lado final recebido do motor é mantido; não há uma segunda inversão no adaptador.
- Seleção explícita pela combinação corretora/conta/subconta; não escolhe a primeira
  conta disponível nem associa uma instituição por um código inventado.
- Validação de ativo exato, prazo e atualização dos metadados, lote, quantidade e tick.
- Inteiros de 64 bits atravessam JSON como strings, inclusive IDs maiores que o limite
  seguro do JavaScript. A futura ponte Windows deverá usar tipos nativos Int64.
- Separação entre aceite local da DLL, confirmação da ordem e posição da conta.
  Estados parciais, cancelamento, rejeição e quantidade cumulativa são normalizados.
- A recuperação usa o identificador permanente da corretora; um identificador local
  de uma sessão encerrada não é reutilizado sem esse identificador permanente.
- Rascunho de cancelamento individual, sem cancelamento geral ou fechamento implícito.
- Acompanhamento separado dos eventos de login, roteamento, dados e licença; perda
  de conexão invalida a prontidão e reconexão continua exigindo conciliação.

## Validação realizada

`node --test tests/platformRobotR109ProfitProtocol.test.mjs tests/platformConnectionGuides.test.mjs`

**80/80 aprovados**, sendo **17 novos testes R109**. Incluem limites Int64, preços e
quantidades inválidos, troca de conta/sessão, regressão de fills, cancelamento parcial,
queda/reconexão e consumo das decisões do contrato Reverso/megaten­dência existente.
Fixtures são sintéticas; nenhum fornecedor foi chamado. `git diff --check` aprovado.
Não foram repetidas baterias históricas de estratégias nem realizado build web, pois
esta revisão é aditiva, sem importação nas rotas de produção ou mudança de interface.

## Limite exato desta entrega

O novo módulo é um **adaptador de protocolo testado**, não uma ponte Windows instalada.
Não carrega DLL, recebe credenciais, autentica usuário, reserva risco, instala stops/OCO,
persiste diário ou transmite ordens. Os retornos não liberam risco ou autorizam reenvio.
Metadados e observações precisam vir de um futuro componente privado autenticado;
validar o formato de um objeto não prova a origem dele. Não existe promessa de proteção
atômica ao apenas preparar uma ordem de entrada. Nenhuma capacidade pública foi ativada.

## Trabalho ainda necessário

1. Obter o pacote oficial licenciado `ProfitDLL.zip` com tipos, funções e manual da
   versão contratada. A documentação oficial informa acesso pela área de assinaturas
   Nelogica. Não foi localizado esse pacote nas buscas feitas; isso não prova que o
   titular não possua uma licença em outro local.
2. Implementar e testar a ponte Windows usando os tipos reais dessa versão, mantendo
   callbacks vivos e copiando eventos para uma fila; chamadas de consulta não devem
   ocorrer dentro dos callbacks nativos.
3. Vincular a ponte à sessão/conta do cliente e integrar motores privados, limites,
   reserva durável, diário, cotações, proteção de posições e conciliação pós-reinício.
4. Implantar em ambiente autorizado e validar externamente conta, licença e permissão
   de roteamento por instituição. O teste de uma corretora não certifica as demais.
5. Concluir ensaio demonstrativo com confirmações oficiais antes da ativação humana.

O saldo continua na corretora do cliente. Não houve ordem, saque, contratação ou
mudança na produção. O trabalho técnico total ainda não está concluído.

## Referências oficiais consultadas

- https://ajuda.nelogica.com.br/hc/pt-br/articles/13312468554651-Como-rotear-ordens-com-a-ProfitDLL
- https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos
- https://ajuda.nelogica.com.br/hc/pt-br/articles/51583791325211-Como-obter-acesso-%C3%A0-ProfitDLL

Revisados antes da implementação: registro R104 atualizado até R108; B159, B171–B174;
relatório B171–B173 preservado; catálogo e mapa de conectores. Não foi encontrado um
adaptador operacional Profit nesses pontos de continuidade. Nada deles foi reescrito.
