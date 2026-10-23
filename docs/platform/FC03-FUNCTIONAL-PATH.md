# JENIOS FC03 — caminho funcional offline e recuperação do núcleo original

FC03 permanece em andamento. Esta entrega integra os refinamentos certificados R50–R59 à candidata FC02, verifica a identidade esperada do núcleo privado e testa um percurso existente com respostas locais simuladas. Não certifica o carregamento do núcleo original nem uma conta externa conectada.

## Bases e preservação

- FC02: `1995a3c4f87f269b9506af0caada7633d05f149a`, backup `backup/jenios-fc02-consolidation-certified-20261023`, CI `39955622795` aprovada.
- R59: `f7dd8f4a0db658dcd3bd957bc403c397d08f7621`, backup `backup/jenios-robot-r59-final-research-certified-20261023`, CI `39957136366` aprovada.
- Foram incorporados 33 arquivos alterados de R49 a R59, sem modificar seus bytes.
- O placar R59 passa a ser o atual. O placar R49 da FC02 permanece integral em `evidence/variants/ROBOT_MASTER_PERFORMANCE_LEDGER_R49.json`.
- O manifesto FC02 original permanece intacto. O verificador FC03 valida seus 353 hashes usando a relocação explícita do placar anterior, além dos 33 hashes R59.
- A outra alteração de arquivo preexistente é `vercel.json`, para bloquear a candidata FC03 e seu backup. Nenhuma branch certificada foi alterada.

## O que foi exercitado

O teste `platformFC03FunctionalPath.test.mjs` passa pelo leitor Alpaca já implementado, vínculo da conta ao cliente, propostas dos modos direct/hybrid/reverse, cálculo B152 de risco, consulta de ordem parcial e reconciliação R49. Respostas e credenciais são fixtures locais. O hash declarado no sinal é um dado de teste: não comprova execução do motor.

A trilha registra cada etapa e distingue chamadas ao transporte simulado de requisições externas. Divergência de quantidade bloqueia a próxima ordem na pesquisa. Outro usuário, vínculo revogado e ambiente live são recusados; mudança de identidade da conta impede a consulta da ordem. Resultado desconhecido ou timeout não autoriza reenvio.

Alpaca foi usado por ser um caminho concretamente implementado. Isso não seleciona a corretora comercial do cliente nem confirma uma conexão autenticada. O modelo continua software/robô licenciado na conta do cliente. Não se introduz uma liberação institucional genérica como requisito.

## Núcleo privado original

A documentação B149–B154 identifica como fontes o backup privado consolidado B53 e o serviço privado B101–B105 da Library. Identidades esperadas:

- `engine.mjs`: `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`
- `service.mjs`: `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be`

As buscas locais, em 51 ZIPs JENIOS, no Drive conectado e nas Pages acessíveis não localizaram esses bytes. A busca não foi exaustiva da Library: a ferramenta conectada não fornece inventário genérico dos seus arquivos e o navegador não ficou disponível.

`fc03-inspect-original-core.mjs` usa o caminho privado indicado em `JENIOS_B297_PRIVATE_CORE_DIR`, lê os dois arquivos e compara os hashes fixados. Não importa código, não copia fonte, não imprime conteúdo ou caminho privado e recusa symlinks. Arquivos ausentes ou divergentes produzem diagnóstico explícito e saída 2. Mesmo hashes corretos não certificam dependências nem execução. Não há teste positivo do arquivo genuíno nesta entrega, porque ele não está disponível.

Quando o pacote for recuperado, mantê-lo fora do GitHub público. Inspecionar dependências e usar o runner privado B297 existente; não reconstruir o motor nem substituir seus resultados por callbacks de teste. Nenhuma chave de corretora é necessária para esse ensaio sintético offline.

## Critério restante para encerrar FC03

Recuperar os bytes originais, executar as funções originais no ambiente isolado e observar suas decisões no caminho escolhido. Enquanto isso não acontecer, `privateEngineLoaded`, `originalCoreDecisionObserved` e `externalIntegrationCertified` ficam false, e `blockComplete` permanece false.

FC04 e FC05 têm trabalho independente e podem avançar sem transformar essa pendência em aprovação. A homologação prática dos robôs também está em andamento no chat “Certificar robôs JENIOS R59”; consultar seu resultado antes de repetir jornadas.

Produção, merge, deploy, ordens reais, Paper externo, e-mails e cobranças permanecem fora deste bloco. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem null.
