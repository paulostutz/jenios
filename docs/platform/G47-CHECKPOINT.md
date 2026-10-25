# G47 — mensalidade Platform por Pix manual

Decisão do titular em 24/10/2026: renovação manual. Base publicada G46/PR9: `9c8493ebbdb99002271ae6292d475facfa1ad4bf`.

Cada cobrança depende de consentimento sobre produto, preço em BRL e termos; de sessões verificadas nos dois provedores Auth; e de vínculo permanente de um pagador para uma conta Platform. A migração não cria contas, pedidos, assinaturas ou pagamentos. Nunca vincular por e-mail ou `user_metadata`.

A emissão exige simultaneamente a chave geral de pagamentos e a aprovação na configuração G47. A configuração inicia desativada. Os três preços iniciais são R$ 99,90, R$ 149,90 e R$ 199,90. O catálogo não sobrescreve preços já existentes. Cada pedido conserva o preço aceito.

Um Pix corresponde a um mês de calendário em Brasília, contado da confirmação bancária. A renovação é disponibilizada no vencimento. Não há débito automático, antecipação de meses ou troca de plano durante o período pago. O cliente pode não renovar e desativar lembretes, mantendo o mês já pago.

A confirmação exige pedido, vínculo, valor, moeda, txid, comprovante único e horário conferidos. A renovação reutiliza a identidade da assinatura, preservando o controle G45 por período. Reembolsar o pedido ou revogar o comprovante retira o acesso correspondente. Um pagamento atrasado que conflite com outro período fica registrado como recebido em conferência e bloqueia novas compras até tratamento pelo suporte; não gera duas franquias.

A página consulta o pagamento a cada 15 segundos quando visível e permite retomar o pedido ao voltar. Não foi configurado webhook bancário ou novo agendamento; a confirmação automática depende da consulta autenticada. Pix emitido sem resposta é retomado com o mesmo identificador, usando GET/PUT do Inter já existente.

Contas exclusivas Platform e Social continuam independentes. Esta etapa vincula cobrança, sem conceder laudos privados, administração ou operações reais à sessão Social. Novos cadastros Platform continuam sujeitos à liberação existente. A contratação requer as duas contas verificadas.

Antes da ativação pública: conferir migração e gates, concluir homologação com as duas contas do titular e um pagamento real efetuado pelo titular. Não usar dados financeiros de teste na produção. Não ativar Pro, corretoras, trial ou envios de teste por consequência desta publicação.

Validação: testes de unidade e segurança; PostgreSQL 17 descartável para concorrência, recibos, meses, renovação, reembolso e conflitos; compilação e verificação integral da fonte. Evidências finais ficam no checkpoint e backup G47 da tarefa.

A prévia G47 aceita somente a branch exata de revisão no projeto correto, banco Social de homologação e todas as ações externas explicitamente desativadas. Usa apenas configuração pública; não recebeu chaves bancárias, IA ou banco privilegiado. A aprovação da branch vale apenas para Preview e não permite sua publicação direta em Production. A homologação financeira completa continua dependente do ambiente e das contas do titular.

Documentação consultada: https://developers.inter.co/duvidas-frequentes e https://supabase.com/docs/reference/javascript/auth-getuser.
