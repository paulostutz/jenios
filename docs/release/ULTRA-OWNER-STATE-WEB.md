# Ultra — estado do titular e carteira sem valores fixos

Base pública: JENIOS `6d1f58efc6e5d79aac30e4e8e29c60995ef411ea`. A publicação independente altera somente carteira, painel de consulta, API de leitura e seus verificadores/testes. Preserva as correções publicadas de comunidades, copy, broker, torneios, engenharia reversa e risco. Não publica laboratórios, habilita negociação ou cria cobranças.

## Comportamento

`/carteira` exige o acesso dedicado da Platform. Saíram o limite de R$ 45.820, o plano Pro, os dois mestres, as faturas/recibos fixos e o alerta de falsa sincronização. O botão de atualização faz uma consulta à API. A mesma consulta aparece na área Ultra.

`GET /api/platform/ultra/state` valida o token no Auth existente, usa somente o titular verificado para as consultas e confere a sessão novamente após a espera. A configuração salva e os registros de conexão vêm das tabelas existentes da Platform, filtradas pelo titular. Configuração antiga sem conector explícito permanece com conector pendente; ela não cria um direito pago.

Plano contratado, carteira, ciclos, obrigações, executor, política e operações podem vir da fonte autorizada do runtime. O envelope valida titular/plataforma, nonce, datas recentes e campos permitidos. Campos de credencial e linhas SQL brutas não entram na resposta. A fonte ausente, inválida, desatualizada ou pertencente a outro titular fica indisponível; não vira saldo zero, assinatura ativa ou pagamento confirmado.

A carteira da plataforma não usa saldo da corretora. Valores de demonstração têm marcação explícita. Custos incompletos mantêm o resultado pendente. Ganhos, perdas e custos por período/geral são separados por conta, ambiente e moeda, utilizando relatórios recebidos da fonte; o painel não cria cobrança nem recalcula performance. Valores decimais de operações usam o formatador exato existente.

A sessão invalida dados em troca de titular, nova leitura, foco/restauração da página e desmontagem. Respostas antigas não reaparecem depois da troca. Não há armazenamento de saldos no navegador.

## Fonte do runtime

Configuração server-side opcional: `ULTRA_RUNTIME_ENABLED=true`, `ULTRA_RUNTIME_ORIGIN` (HTTPS, somente origem) e `ULTRA_RUNTIME_SERVICE_KEY`. Nada disso é pedido ao cliente ou incorporado ao frontend. Os valores não foram criados, solicitados ou ativados nesta entrega.

O serviço monta `createRuntimeStateService` em `/v1/ultra/state`. Seu resolvedor deve mapear a identidade autenticada do produto ao consumidor autorizado; não usar e-mail ou identificador fornecido pelo navegador. A origem é configuração do operador, não uma API alegadamente existente da corretora.

A fonte produtiva não é presumida. Sem o resolvedor e a fonte autoritativa, as seções financeiras permanecem indisponíveis. O serviço é somente de leitura: ele não executa Start, pausa, ordens ou pagamentos. Os fluxos operacionais existentes continuam sujeitos aos seus próprios controles.

## Verificação

Testes de API cobrem autenticação, contexto de titular, origem, indisponibilidade, datas/nonce, troca de sessão, campos sensíveis, cálculo coerente de saldo e consultas filtradas. Testes de componentes em Node, sem DOM ou navegador, cobrem respostas antigas, valor ausente e atualização efetiva. A guarda executa o verificador exato da produção anterior e confere a nova árvore e inventário; não elimina guardas históricas.

Nenhuma prévia, navegador, DOM, screenshot ou superfície alternativa foi usada. Nenhuma ordem real, testnet, credencial de saque, cobrança ou movimentação foi executada. A publicação usa somente a superfície e o público existentes.
