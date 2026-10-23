# FC05 — Homologação integrada local

Base conferida: backup FC04 `65e640b17e670b0a5e5bc9d0e0c056fec5fc5fd6`.

Este bloco verifica jornadas públicas e acesso negado no navegador, em desktop e celular, contra um servidor Next local com credenciais fictícias e criação de pagamentos/envios desativada. Requisições do navegador para outras origens são interceptadas e bloqueadas. Não certifica sessões de clientes, permissões reais do Master nem entrega de fornecedores.

A resposta incompleta simulada do atendimento derrubou a tela antes da correção (`Cannot read properties of undefined (reading 'map')`). O cliente agora valida o conteúdo antes de atualizar a conversa, rejeita links externos ou inválidos e mantém as respostas anteriores quando há falha de rede, JSON ou serviço. Uma nova pergunta pode recuperar o atendimento pelo endpoint local real.

A mensagem de acesso administrativo negado e seu link de login receberam contraste legível sobre o fundo escuro. As regras de autorização permanecem as mesmas.

A rota antiga `/relatorios` continha ganhos, taxa de acerto e sessões fixas; o botão de PDF apenas exibia uma confirmação. Ela agora informa resultados não apurados e oferece acesso à conta e ao atendimento, sem inventar resultados ou downloads.

O teste de navegador cobre Social → apresentação da Platform, atendimento → API local → planos, Universidade para visitante, checkout indisponível, relatórios, login/recuperação e áreas administrativas bloqueadas. São conferidas larguras de 1280, 390 e 320 pixels e respostas 401 das APIs privadas. Falhas de atendimento são fixtures explicitamente identificadas; os caminhos normais e as negativas de autorização usam o servidor real local.

Preservação: os arquivos FC04 alterados têm seus bytes originais arquivados, com verificação contra o blob Git do commit certificado. Manifestos, checkpoint e testes anteriores permanecem intactos. O verificador FC05 valida toda a árvore FC04 com essas exceções explícitas; o verificador FC03 continua verificando os hashes herdados e do R59. O verificador FC04 original é preservado para seu próprio snapshot.

Permanecem pendentes: aceite autenticado de cliente e Master, integração do núcleo original à jornada atual, ciclo externo de assinatura, confirmação/recuperação de conta e entrega de e-mails. O checkpoint HP03 da frente separada registra o núcleo original executado offline; isso não substitui o aceite integrado.

Produção, merge, deploy, ordens reais, Paper externo, envios e cobranças permanecem fora deste bloco. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`.
