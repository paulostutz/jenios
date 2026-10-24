# JENIOS G43 — Gênio e Gênia com continuidade de conversa

Data: 24/10/2026. Branch: `feat/jenios-genios-contexto-20261024`.

## Base e objetivo

Este bloco parte da fonte de produção R42, commit `e9926d975a48c72ac3815de6fc6d3bdae717d7c5`, árvore `d5de6d958442bac527d643a800bfa1f5c98721a5`. O diagnóstico anterior confirmou atendimento predominantemente guiado, ausência de histórico no contexto do modelo e perdas de continuidade entre telas/personas. A implementação reúne memória, interpretação, contexto autorizado e interface, aproveitando seletivamente a política comercial B282–B284 da homologação.

O manifesto `G43-PRODUCTION-BASELINE.json` identifica cada blob original e cada alteração revisada. O verificador recusa mudanças fora do escopo. A fonte dos e-mails R42, Auth, recuperação de senha, PAY, Inter, conectores de corretora e currículo foi preservada. O link da aula para o tutor Pro recebeu o identificador da aula. Nenhuma migração foi aplicada em banco hospedado neste bloco. Nenhuma chave foi extraída, criada ou ativada.

## O que mudou

### Mesma inteligência, duas personas

Gênio e Gênia compartilham conhecimento, critérios e contexto. Trocar a persona preserva a conversa. Trocar a conta cancela esperas, invalida respostas atrasadas e limpa o estado privado da interface. LP, Social e Platform usam o atendimento contextual; o Pro mantém canal próprio. As consultas existentes continuam acessíveis em `/platform/assistente/consultas`, com autorização individual em cada serviço.

### Memória no servidor

O navegador armazena somente o ID da conversa, associado à conta/canal. Não aceita histórico, resumo, proprietário, plano, permissões ou resultados de ferramentas fornecidos pelo cliente como autoridade. Usuário autenticado é resolvido no servidor; visitante usa cookie opaco assinado, `HttpOnly`, `Secure` e `SameSite=Lax`.

Conversas de visitante e sessões sem opção de lembrar expiram em 24 horas. Usuários autenticados podem escolher 30 dias antes de iniciar uma conversa. A exclusão remove fisicamente conversa, turnos e avaliações; o histórico contábil independente do Pro permanece. A rotina de expiração impede leitura depois do prazo e há função de limpeza física. **O agendamento periódico dessa limpeza precisa ser configurado antes da ativação hospedada**; não foi criado um job remoto neste bloco.

As RPCs são exclusivas de `service_role`, com RLS e filtros por proprietário. Revisão, lease de turno e chave idempotente impedem gravações concorrentes incorretas e reenvios automáticos. Um turno com resultado incerto permanece em conferência. O resumo é limitado e distingue relatos do usuário de fatos autorizados. Há limites de conversas e turnos; não se promete memória ilimitada.

### Interpretação e conhecimento

O fallback reconhece paráfrases, negações e intenções comerciais sem confundi-las com ordem de compra/venda de ativos. As sugestões do próprio atendimento têm material correspondente. Perguntas de continuação retomam tópico, planos comparados, correções e etapas relatadas; ambiguidades relevantes provocam uma pergunta específica.

O contexto generativo inclui até oito pares concluídos, resumo limitado e material oficial. A compactação reduz material alheio antes de descartar pares antigos, preservando os últimos dois pares completos. Uma etapa que o usuário diz ter concluído continua sendo um relato não verificado. A conversa não pode confirmar pagamentos, conceder acesso, alterar cadastro, emitir ordens ou prometer monitoramento.

Plano e situação da conta vêm de consulta autorizada, sem e-mail, ID de proprietário, saldo ou credenciais no payload. Aula do Pro exige direito de acesso, liberação no currículo e ausência de avaliação em andamento. Consultas de ferramentas usam somente a projeção autorizada, com horário de consulta separado da data de origem. Resultados antigos são selecionados apenas quando pertinentes ao assunto atual. Identificadores públicos longos de transação não são copiados para o texto da memória: a igualdade da solicitação é protegida por fingerprint interno.

### Consumo e Pro

O suporte permanece gratuito ao usuário. A geração opcional de suporte tem orçamento próprio da operação: modelo com tarifa explícita no projeto, reserva conservadora de US$ 0,02, contagem prévia de até 16.384 tokens de entrada e até 900 de saída. Não há inferência se configuração, orçamento ou contagem não forem confirmados. Não há reenvio nem reembolso automático de reserva diante de transporte incerto.

O Pro segue a política aprovada de acesso nos planos de R$ 149,90 e R$ 199,90. As três rotas de venda de créditos avulsos retornam `410 / AI_CREDITS_SALES_DISABLED`; extratos e liquidações históricos continuam disponíveis. Não foram aprovados novos preços, franquias ou limites de produção.

O orçamento assinado vincula usuário, tarefa, mensagem, imagem, conversa/revisão, aula e digest do contexto. Mudança de contexto invalida o orçamento antes da reserva. Dispatch e liquidação continuam usando o ledger original. Uma resposta liquidada é exibida mesmo que a memória falhe, com aviso de sincronização. A recuperação posterior confere proprietário, chave e fingerprint no ledger; nunca gera nem cobra novamente. Nesse reparo excepcional, a resposta é recuperada com o resumo anterior, sem inventar novas referências.

### Interface e melhoria controlada

A pergunta aparece imediatamente, acompanhada de progresso, rolagem e botão para interromper a espera. O prazo da interface é de 45 segundos no gratuito e 65 segundos nas consultas/Pro. Interromper a espera não declara custo zero nem dispara outra geração. A imagem selecionada no Pro permanece para a pergunta seguinte até remoção/troca de conta; imagens não são persistidas no histórico.

Cada resposta pode receber avaliação e uma nota curta. Compartilhar a nota com a equipe exige escolha explícita. `/admin/assistentes` é exclusivo Master e mostra avaliações consentidas, assuntos e observações limitadas, sem transcrição integral. Identificadores comuns são removidos das notas, sem promessa de anonimização perfeita. Comentários não viram conhecimento oficial automaticamente: exigem fonte, revisão e teste antes de uma alteração de conteúdo.

## Validação e limites da evidência

Foram exercitados corpus interpretativo, payload do provedor com transporte simulado, preservação do contexto, negações, preços, limites, cancelamento, segregação por conta, repetição, concorrência e falhas de armazenamento. O navegador local verificou 21 cenários com APIs simuladas e sem erros JavaScript. As regressões S05 passaram em 94 casos. A compilação local de produção passou.

O runner `scripts/test-genios-conversations-postgres.mjs` aceita somente PostgreSQL loopback e banco vazio com prefixo `jenios_genios_g43_`. Ele carrega as migrações reais, os controles financeiros originais necessários à fixture e testa RLS/grants, duas contas/visitantes, expiração/exclusão, feedback, reparo Pro sem modificar cobrança e concorrência real. Também executa os serviços HTTP reais de conversa e suporte com o repositório/SQL: comparação Nacional–Global Crypto, “E o segundo?”, resposta de R$ 149,90, replay sem nova revisão e exclusão física.

O CI desta branch usa Node 22 e PostgreSQL 17, executa a suíte herdada e `npm run build`, confere o manifesto da produção e preserva ZIP da fonte exata, SHA256, commit e logs. Os resultados finais do CI devem ser consultados pelo SHA do commit, nunca inferidos da execução de outra branch. No runtime local Node 24 há um problema preexistente de captura de stdout de subprocessos no teste B152; esse arquivo permaneceu inalterado e o CI Node 22 é o gate correspondente.

Estes testes validam lógica, contratos, SQL e comportamento da interface. **Não certificam qualidade de respostas de um modelo real, latência de produção, operação financeira real nem a disponibilidade atual de modelos/tarifas na conta do provedor.** Nenhuma chamada paga foi feita. A interpretação guiada é limitada e deve pedir esclarecimento quando não houver base suficiente. Os filtros de resposta não garantem acerto semântico universal.

## Ativação posterior, coordenada com o Work

1. Conferir o último checkpoint do Work para os e-mails e a fonte efetivamente publicada. Reconciliar mudanças posteriores à R42 antes de integrar esta branch.
2. Instalar primeiro em homologação as duas migrações G43: memória e orçamento comercial. Não reutilizar a migração B282 que também contém Inter/Vault.
3. Configurar um segredo exclusivo `JENIOS_ASSISTANT_SESSION_SECRET` com pelo menos 32 bytes; ele é somente do servidor. Ativar `JENIOS_ASSISTANT_MEMORY_ENABLED` apenas após conferir schema, isolamento, retenção e agendamento da limpeza `jenios_assistant_cleanup_g43`.
4. Validar modelo/tarifa atuais e definir orçamento autorizado antes de qualquer chamada real. Suporte depende de `JENIOS_SALES_GENERATIVE_ENABLED`, `JENIOS_SALES_MODEL`, `JENIOS_SALES_VISITOR_SALT`, `JENIOS_AI_MONTHLY_BUDGET_USD` e credencial do provedor. Pro mantém seus próprios gates, modelos, orçamento, franquias e segredo de cotação.
5. Executar amostra real aprovada de conversas em vários turnos, medir tempo de resposta/fallback e avaliar pertinência, correção factual, contexto e recuperação. Usar falhas concretas para ampliar o corpus; não repetir testes de Auth já aceitos sem regressão.
6. Publicar somente a fonte integrada e certificada, confirmar domínio/ambiente corretos e observar os primeiros atendimentos. A branch G43 é permitida apenas como preview isolado, com geração desligada; o guard rejeita sua promoção direta à produção e rejeita geração paga no preview.

Rollback inicial: desligar os gates novos preservando a fonte anterior e os registros existentes. Não apagar ledger contábil nem restaurar snapshots sobre dados novos para desfazer uma interface. Não alterar e-mails, Inter, Letter, CHEFE ou robôs de negociação para ativar esta camada conversacional.
