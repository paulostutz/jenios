# JENIOS — integração Letter CB006

Cobrança central exclusiva dos três planos Platform e da mensalidade própria da Universidade, com preços e versões comerciais existentes. Produtos e repasses de terceiros não participam. Social e Platform continuam com identidades independentes; a contratação Platform exige as duas sessões e o vínculo explícito existente.

Pedidos/recibos têm histórico imutável, reserva durável e consulta antes de qualquer recuperação. A liberação usa a competência aceita originalmente, sem extensão causada por pagamento atrasado. O recebimento precisa corresponder ao produto, empresa, recebedor, cliente, valor e período. Estorno/cancelamento no pedido nativo retira o acesso sem apagar o recibo. Os registros anteriores seguem no provedor original. Os painéis de cobrança consultam os dados da conta; o antigo /billing com exemplos fixos de plano ativo e pagamentos foi substituído por consulta real.

31 verificações PostgreSQL e 11 testes Node isolados aprovados. Nenhuma cobrança real. Build completo, publicação e homologação são registrados no relatório de implantação após conferência.

A migração db/letter-billing-cb006.sql é aditiva e não cria configuração habilitada, preço ou contrato. JENIOS_LETTER_INTEGRATION_ENABLED habilita leitura do recibo na política de acesso e direciona novas contratações próprias à Letter; status de cobranças antigas permanece acessível. Emissão depende separadamente de JENIOS_LETTER_BILLING_ENABLED, JENIOS_LETTER_RECEIVER_ID, JENIOS_LETTER_SERVICE_TOKEN (Platform), JENIOS_LETTER_UNIVERSITY_SERVICE_TOKEN (Universidade) e configuração privada válida. Cada credencial deve ter apenas sua finalidade e prazo finito. Certificado e segredos bancários não saem da Letter.

O serviço de banco, permissões do recebedor e a homologação precisam estar concluídos antes de ativar. Publicação de código não significa operação financeira comprovada.

As regressões anteriores rodam com a integração nova desativada; os testes CB006 configuram o novo caminho explicitamente, incluindo suspensão da emissão com conciliação preservada. O gate R106 mantém o manifesto-base original e verifica uma extensão CB006 fixada por hash, sem permitir arquivos adicionais desconhecidos.
