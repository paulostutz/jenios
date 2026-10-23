# JENIOS ROBOT-R6 — assinatura de evidência local e cronologia (somente laboratório)

Checkpoint: 22/10/2026. **Escopo exclusivo:** Manual, Híbrido e Reverso; não alterar produto comercial, B303, CHEFE, LETTER, bancos, corretoras, motor privado ou produção.

## Base e recuperação
- ROBOT-R5 certificado: 4e15a138e740863899a1871a836c02f33d5d7f69; GitHub CI 39710258841 SUCCESS.
- Backup pré-R6: backup/jenios-robot-r6-pre-signed-witness-4e15a138-20261022.
- Branch isolada: fix/jenios-robot-r6-signed-witness-chain-20261022.
- Desenvolvimento aditivo, sem deploy de Preview.

## Técnica
- Reutiliza **exatamente** o selamento prospectivo prévio R5 e a comparação pareada de OHLCV atribuídos aos dois provedores; não repete nem substitui suas regras.
- Acrescenta recibo de registro (registrar) e recibos por linha de mercado (collectors) assinados com Ed25519, verificando domínios criptográficos distintos, três chaves configuradas e diferentes, SHA-256 do candle original e sequência local encadeada.
- Checagem cronológica: registro declarado antes do início previsto; captação após fechamento + cinco minutos pelo R5; recebimento assinado até 120 segundos após captura declarada, sem ultrapassar o relógio de avaliação.
- Proíbe campos adicionais com supostas ordens, assinaturas oficiais, timestamp independente, preenchimentos, P&L ou atestação fictícia.
- Detecção de duplicidade de nonces e sequência errada dentro do mesmo lote. **Não** possui proteção antirreplay durável entre sessões; B299 é um diário local separado e não é indevidamente reutilizado para este novo esquema.
- Quando duas fontes declaradas divergem acima da tolerância R5, nem uma cadeia de assinaturas válidas autoriza comparação de preços.

## Limite crucial
Uma assinatura feita por uma **chave configurada localmente** atesta integridade perante essa chave. Ela **não** comprova titular real, identidade de corretora, resposta oficial do provedor, instante independente, decisão do motor proprietário, sinal recebido por cliente, execução Paper/real, perda neutralizada ou lucro. Chaves são criadas apenas no ambiente efêmero de testes, não em repositório ou CI artifacts. Não existem segredos de corretoras nem uso pago de IA.

## Aceite
Testar assinatura violada, duplicidade/replay local, cruzamento de escopos, timestamps fora de ordem, reordenação da cadeia, chaves iguais ou inadequadas, divergência entre provedores e 300 horas sintéticas / 30 dias sem alegação de observação real. Executar regressões completas, salvar CI, hashes, backup e preservar B177-R3.

**Gate:** CONTRACT_QA_PASS quando CI concluída. Integração de fonte independente, rentabilidade e execução permanecem NO_GO.
