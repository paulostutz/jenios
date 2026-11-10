# Ultra R128: conciliação das duas R127

Candidata local, somente simulação. Não publicada. Nenhuma ordem real ou de demo externa foi enviada. Não há validação visual, native/ProfitDLL, acesso a conta real, alteração de API pública ou ativação de cobrança.

## O que foi conciliado

- Sessão durável: f19607c6d970211106908868e7dc5930a7b269ca.
- Operações, atribuição e journal Profit: f0ec442f27b0a72bcf72fe512682c5c5653ee586.
- A árvore R126 do parent a9b6ecefc2a53374b1b17e0cce352020d3b0bda4 é idêntica à árvore 02f547531d4e2353fa1c397d0a6cb2b8edb68b2c. As histórias Git são diferentes; esta candidata preserva ambas por inventário/hash.
- Os dois módulos R127, suas estratégias, APIs, arquivos de teste e arquivos ZIP permanecem com bytes originais. A colisão de nomes foi resolvida somente por aliases: o empacotador de operações passou a package-operations-r127.py e seu teste de integridade a platformUltraR127OperationsIntegrity.test.mjs. Os manifests originais não foram reescritos.
- A ponte aditiva session-runtime-r128.mjs herda os hooks operacionais R127 e aplica controle de sessão antes da captura das closures. Lease/controller, relógio, prontidão e gravações são cercados; cada chamada de fixture confere controle antes e depois de await. Antes de abrir, confere pausa, fase e prazo novamente.
- Atribuição valida sessão, dono, conexão, produto e digest da configuração recebida; preserva provider e scope no vínculo da sessão. Para uma nova sessão, reabra o ledger com o novo contexto. Custos tardios conservam a origem da operação antiga.

## Executar o pacote offline

Use Node 24+ com node:sqlite. Extraia em pasta nova, sem arquivos de conta, credenciais, DLL ou banco anterior. Não é necessário npm install para estes ensaios.

1. `node --test tests/platformUltraR127Session.test.mjs tests/platformUltraR127Runtime.test.mjs tests/platformUltraR127Records.test.mjs tests/platformUltraR127Profit.test.mjs tests/platformUltraR127Integration.test.mjs tests/platformUltraR128Conciliation.test.mjs`
2. `node scripts/platform/ultra/qualify-r128.mjs ./resultado-r128-novo`
3. Confira R128-OFFLINE-INTEGRATION.json no diretório de saída. São quatro fluxos com conta fictícia: spot, futuros, WIN e WDO. Cada fluxo simula perda de resposta, reinício, recuperação sem reenvio, cancelamento do restante, fechamento parcial/final, custos tardios e encerramento da sessão sem renovar o prazo.
4. Para o ensaio anterior de sessão: `node scripts/platform/ultra/rehearse-session-r127.mjs`.

O qualificador recusa pasta de saída não vazia. Ele cria apenas SQLite e relatórios fictícios nessa pasta. A estratégia e o dimensionamento existentes não foram substituídos. Os testes acrescentados também cobrem MT5/B3 com fixture, sem comprovar integração MT5.

## Recuperação e limites

O journal e as tabelas já existentes são reutilizados. Não migre uma sessão R127 ativa para a ponte R128. Encerre-a com o runtime original e com ausência confirmada de exposição, então use novo ID e novo contexto; a ponte rejeita adoção silenciosa de mesmo ID com schema antigo. Nunca apague pendências para permitir Start.

A pausa impede novas entradas, mas não comprova fechamento. Finish retorna draining enquanto houver posição ou comando não confirmado. Deadline permanece o original ao reiniciar. Recibo incerto não autoriza reenvio automático. Falha de relógio, identidade, permissão ou reconciliação falha de forma fechada.

O journal Profit R127 está preservado e testado separadamente. Sua sessão é de transporte/correlação, não equivale à sessão durável. A ponte não expõe mutações diretas desse journal nem conecta callbacks nativos. Observação local não é comprovante financeiro. Feed de atribuição continua evidenceMode=offline_fixture, financialActivationAllowed=false e billingDecisionIncluded=false.

A configuração existente de UI/API continua intacta e não chama esta ponte automaticamente. O teste disponível é o CLI offline acima. Para uso conectado faltam integração autorizada com o serviço/terminal real, reconciliação real da conta própria e validação de execução/proteção/redução. Não solicitar nem incluir senhas/tokens neste pacote. O bloqueio de prévia visual foi respeitado; nenhuma superfície alternativa ou publicação foi usada para substituí-la.
