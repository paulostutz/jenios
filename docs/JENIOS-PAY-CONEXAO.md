# Conexão da interface V7 à JENIOS PAY existente

## Escopo deste código

O Banco Inter e os webhooks existentes não são substituídos. Este bloco implementa catálogo, edição administrativa de preços, consultas de pedidos e um adaptador HTTP para encaminhar contratações à PAY.

O adaptador é um contrato novo na fronteira da Social: ainda deve ser compatibilizado com o endpoint real da instalação PAY do usuário. Não é evidência de compatibilidade já verificada nem de pagamento real executado.

## Configuração server-side

- JENIOS_PAY_CHECKOUT_URL: URL HTTPS exata do endpoint existente de criação de checkout.
- JENIOS_PAY_API_TOKEN: credencial própria desse endpoint. Não reutilizar certificados, chave privada do Inter ou token administrativo.
- JENIOS_PAY_CHECKOUT_ORIGINS: origens HTTPS adicionais autorizadas para redirecionar ao checkout, separadas por vírgula. A origem do endpoint já é autorizada.
- JENIOS_APP_ORIGIN: opcional, origem HTTPS do site sem caminho. Acrescenta returnUrl ao contrato: /social/cobrancas para Social e /checkout para Platform. A PAY deve aceitar esse campo; não é confirmação de pagamento.
- JENIOS_SPECIALIST_ORDERS_ENABLED=true: ativar apenas depois de instalar e validar a migração de atendimentos do checkpoint 11 em homologação. Desligado preserva o fluxo financeiro existente e informa que a gestão de atendimentos ainda não foi ativada.
- JENIOS_BOOST_CAMPAIGNS_ENABLED=true: ativar somente depois de instalar e validar a migração de campanhas do checkpoint 12. Ausente/false preserva o fluxo anterior.
- JENIOS_BOOST_SIGNING_SECRET: chave aleatória própria de pelo menos 32 bytes, somente servidor, para comprovantes curtos de exibição. Não reutilizar chave Inter, token PAY ou credencial Supabase. Com campanhas ativas e chave ausente, novas contratações são bloqueadas antes de criar pedido.
- NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED=true: renderiza o componente opcional de publicidade no feed original e no compartilhado. Requer a extensão, a flag de servidor e a chave de assinatura já configuradas.
- JENIOS_PAY_ADMIN_USER_IDS: IDs de usuários Supabase autorizados à gestão financeira, separados por vírgula. Alternativamente, app_metadata.role igual a admin ou finance_admin, atribuído por backend confiável.
- NEXT_PUBLIC_SUPABASE_URL e chave pública compatível com lib/supabase.js.
- SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY: somente no servidor.

Não há segredos incluídos no pacote.

## Contrato do adaptador

POST autenticado com Bearer e cabeçalho idempotency-key igual ao orderId. JSON enviado:

    { orderId, userId, productCode, amount_cents, currency: 'BRL', billing_type, scope, target }

Resposta JSON esperada:

    { orderId, amount_cents, currency: 'BRL', checkoutUrl: 'https://...' }

O adaptador verifica correspondência do pedido, valor e moeda; não aceita redirecionamentos fora das origens autorizadas. O pagamento não é confirmado pela resposta do checkout nem pelo navegador. O backend PAY existente deve registrar confirmação na tabela de pedidos e conceder o acesso correspondente.

O orderId é a chave estável que a PAY deve usar para impedir criação duplicada de cobranças. Timeouts são retentados com o mesmo orderId; não se presume exatamente-uma-vez sem garantia do provedor existente.

## Catálogo e admin

Rota: /admin/cobrancas. Autenticação real Supabase e autorização em todas as chamadas. O login de demonstração do admin legado não concede acesso financeiro.

Checkpoint 20: botão Cadastrar valores iniciais chama POST administrativo com action=initialize_catalog. Os produtos/valores aprovados são definidos no servidor; upsert por code com ignoreDuplicates preserva preços e disponibilidade de produtos já existentes. Não cria tabelas, não emite cobrança nem implementa recorrência. É uma alternativa a salvar cada produto inicial separadamente.

Os preços aprovados são exibidos inicialmente e podem ser cadastrados pelo botão Salvar produto: BankScore R$9,90; Validador R$9,90; Platform R$99,90 / R$149,90 / R$199,90 mensais. A tabela existente jenios_pay_products é reutilizada, sem migrações. Alterações usam updated_at para detectar conflito entre duas sessões. Pedidos anteriores mantêm seu valor.

Impulsionamento: produto de orçamento variável, calculado pelo servidor; o cliente deve ser autor do post. Especialistas: comissão de 10%, sem mensalidade fixa inventada; ofertas são mantidas no perfil existente e o preço é lido no servidor. Divisão e repasses efetivos não foram homologados neste ambiente.

## Veracidade do estado

Checkpoint 19, após correção explícita de escopo pelo usuário: o produto BankScore de R$9,90 é o laudo detalhado de capitalização disponível, com interpretação e histórico, não uma nova análise financeira completa. O bloqueio universal do checkpoint 13 foi substituído pela conferência da instituição/período e consistência do indicador antes de criar pedido/chamar gateway. serviceReady=true no catálogo não dispensa essa conferência. Dado ausente, duplicado ou inconsistente impede cobrança daquela consulta. Endpoint POST /api/bankscore/detailed verifica pedido pago, titular, produto e fingerprint do alvo antes de emitir JSON/PDF. /bankscore/detalhado?pedido=UUID permite restaurar o alvo da sessão ou informá-lo exatamente; acesso não depende da memória do navegador. O extrato em dashboard-logado oferece o link Laudo e PDF. Consulta básica e PDF existentes permanecem disponíveis; nenhum pedido antigo foi revogado ou reembolsado.

Diagnóstico gratuito: /api/bankscore/cobertura e /api/bankscore/cobertura/pdf, com codigo e periodo. Usa tabelas existentes, mostra lacunas, série limitada e inventário bruto quando houver. Não é a entrega do laudo completo pago. Para disponibilizar a venda completa, ainda será necessário implementar/validar os dados complementares, unidades e método; não basta habilitar uma variável.

O checkpoint 10 conecta a consulta detalhada de Criptos ao pedido pago: /social/consulta-detalhada?pedido=<UUID> e POST /api/crypto-validator/detailed. O servidor verifica titular, status paid e fingerprint do alvo antes de consultar a rede ou gerar o PDF. A listagem de cobranças expõe apenas o nome/código conhecido do produto, nunca external_reference, alvo ou fingerprint.

Consulta básica e seu PDF continuam disponíveis. A consulta paga acrescenta interpretação e, para carteira, inventário do checkpoint 20. Não é inventário universal nem auditoria: Solana enumera os programas SPL e Token-2022 (até 500 contas por programa, agregado por mint, confirmado mainnet pelo genesis hash), TRON lê até 300 registros TRC-20 do índice mainnet TronGrid com endereço/checksum conferidos, EVM usa métodos Alchemy no RPC configurado da rede após verificar chainId e endereço da resposta (até três páginas de 100 registros, cursor repetido falha). ETHEREUM_RPC_URL, BSC_RPC_URL, POLYGON_RPC_URL, ARBITRUM_RPC_URL, BASE_RPC_URL e AVALANCHE_RPC_URL só oferecem inventário quando o provedor implementa esses métodos; URL ausente ou método indisponível gera aviso explícito. SOLANA_RPC_URL é opcional; TRON_PRO_API_KEY é opcional e só enviada ao host mainnet fixo.

Metadados adicionais EVM/TRON são limitados aos dez primeiros contratos para controlar tempo e chamadas. Saldos de outros contratos são exibidos em unidades brutas quando não houver decimais confirmados; BigInt evita perda de precisão. Tokens Solana têm decimais da resposta e podem incluir NFTs/extensões, sem análise de fungibilidade ou transferibilidade. Não somar quantidades entre contratos. Correspondência de endereço com catálogo limitado, divergência de símbolo e ausência de referência são estados distintos; nenhum é uma prova universal de autenticidade/fraude. Não calcula parcela falsa do patrimônio, garantia de lastro, liquidez, resgate ou titularidade. Falha estrutural/identidade da fonte descarta inventário inteiro com aviso; limite de páginas mostra parcial. Nenhum cursor, endpoint privado ou erro bruto do provedor é exposto no relatório. Litecoin sem provedor homologado continua bloqueado para nova contratação.

Não há relatório salvo na nuvem. O navegador pode reter os dados do alvo por sessão; se perdidos, o usuário informa exatamente o alvo contratado. Nenhum dado local concede acesso por si só. Nova emissão consulta novamente a fonte e pode observar outro estado. Falha de provedor retorna 503 e permite tentar novamente com o mesmo pedido, sem nova cobrança.

A integração Inter é considerada validada pelo usuário. Este ambiente não homologou a compatibilidade do adaptador com a implementação PAY do Mac nem o retorno real do pagamento. BankScore completo e recorrência ativa da Platform continuam pendentes; campanhas têm distribuição interna implementada no checkpoint 12, ainda não ativada/homologada na instância real. Não promover este pacote à produção como versão final homologada.

## Gestão de atendimentos — checkpoint 11

/especialistas/atendimentos oferece visões de comprador e especialista. API /api/specialists/orders autentica a conta no servidor. Aceite, agendamento, registro de entrega e confirmação do comprador usam uma extensão de atendimento 1:1 com o pedido financeiro existente. A oferta contratada é preservada em snapshot; alterações no currículo não reescrevem o atendimento.

Migração preparada: supabase/migrations/20261015000628_specialist_order_fulfillment.sql. Não aplicada remotamente. Não duplica tabelas de pagamentos: cria somente jenios_specialist_orders, ausente no inventário consultado, com FK única para jenios_pay_orders. Tabelas, referências financeiras e webhooks da PAY não são alterados. A função de transição é SECURITY INVOKER e executável apenas pelo backend service_role; acessos diretos de cliente são somente leitura dos próprios atendimentos, protegidos por RLS.

Com a flag ativa, o atendimento é preparado antes de abrir checkout. Falha na preparação preserva o pedido financeiro pendente e permite retentar sem outra cobrança; não chama gateway. Sem a flag, a implementação anterior permanece operante. Pedidos pagos anteriores à ativação não são importados automaticamente, porque não existe snapshot confiável da oferta original.

Ações de atendimento consultam e bloqueiam a linha financeira na mesma transação, exigem paid e revisão atual. Pedido reembolsado/expirado/pendente não permite avançar o serviço. A recusa é estado de atendimento, não reembolso. Marcar entrega não prova recebimento; somente o comprador pode confirmar. Nenhuma destas ações executa Pix, reembolso, split ou repasse.

O histórico guarda ação, papel e horário, sem e-mails ou credenciais. Links HTTPS são informados pelo especialista; o sistema não cria salas, não envia convites nem notifica terceiros neste bloco. O horário é informado e mostrado no fuso do navegador.

## Campanhas e distribuição interna — checkpoint 12

Migração preparada e não aplicada remotamente: supabase/migrations/20261015001833_boost_campaign_delivery.sql. Inventário remoto não possuía estrutura equivalente. A extensão cria jenios_boost_campaigns (1:1 com pedido PAY) e jenios_boost_events (métricas), sem duplicar cobranças ou modificar tabelas financeiras. Não cria campanha em redes externas.

Com a flag de servidor ativa, snapshot de público, objetivo, destino, orçamento diário e dias é preparado antes de abrir checkout. Falha de preparação preserva pedido pendente sem chamar gateway. Só o dono do post pode contratar e ativar. /impulsionar/campanhas permite iniciar após paid, pausar, retomar e cancelar distribuição. Cancelamento não é reembolso e nenhuma métrica debita dinheiro.

O prazo começa no primeiro start e não é estendido por pausas. Expiração é aplicada na seleção, sem depender de cron. A seleção exclui pedidos não pagos/reembolsados, campanhas inativas/expiradas, posts excluídos, autoria incompatível, bloqueios em qualquer direção e visualização do próprio anunciante. Leitura final do post usa a sessão/RLS do visitante. O objetivo perfil leva a uma página somente leitura do perfil real, sem substituir a navegação legada da Social.

Público por país/região/cidade autodeclarados voluntariamente, sem GPS ou inferência por IP. Comparação textual de país e, quando definidos, região/cidade, ignorando caixa e espaços nas extremidades; não converte siglas ou nomes de cidades. O visitante solicita o conteúdo patrocinado pelo componente opcional. Não há inserção automática de publicidade para visitantes que não informaram região. O orçamento diário pondera a seleção aleatória entre campanhas elegíveis; não garante volume de entrega e não é medição de gasto consumido.

Destinos website/copy exigem HTTPS sem credenciais; WhatsApp usa wa.me com DDI e número completo. O cliente informa o destino antes de pagar. Comprovante assinado vincula campanha, conta, revisão e validade de 10 minutos. Eventos exigem sessão válida e revalidam elegibilidade no banco. Cliente tenta registrar impressão somente após 50% do cartão visível por 1 segundo em aba visível. Cliques também estabelecem impressão. Cada tipo é deduplicado por conta/campanha/dia UTC.

As contagens são registros de uso do cliente, não métricas auditadas ou antifraude completo. Identidades individuais de visitantes não são exibidas ao anunciante; a tabela de eventos não tem acesso direto de anon/authenticated. Limpeza/retencão destes eventos ainda precisa de política antes da produção. As funções são SECURITY INVOKER, executáveis apenas pelo backend, e as campanhas têm RLS de leitura do proprietário.
