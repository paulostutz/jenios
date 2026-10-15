# Conexão da interface V7 à JENIOS PAY existente

## Escopo deste código

O Banco Inter e os webhooks existentes não são substituídos. Este bloco implementa catálogo, edição administrativa de preços, consultas de pedidos e um adaptador HTTP para encaminhar contratações à PAY.

O adaptador é um contrato novo na fronteira da Social: ainda deve ser compatibilizado com o endpoint real da instalação PAY do usuário. Não é evidência de compatibilidade já verificada nem de pagamento real executado.

## Configuração server-side

- JENIOS_PAY_CHECKOUT_URL: URL HTTPS exata do endpoint existente de criação de checkout.
- JENIOS_PAY_API_TOKEN: credencial própria desse endpoint. Não reutilizar certificados, chave privada do Inter ou token administrativo.
- JENIOS_PAY_CHECKOUT_ORIGINS: origens HTTPS adicionais autorizadas para redirecionar ao checkout, separadas por vírgula. A origem do endpoint já é autorizada.
- JENIOS_APP_ORIGIN: opcional, origem HTTPS do site sem caminho. Acrescenta returnUrl ao contrato: /social/cobrancas para Social e /checkout para Platform. A PAY deve aceitar esse campo; não é confirmação de pagamento.
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

Os preços aprovados são exibidos inicialmente e podem ser cadastrados pelo botão Salvar produto: BankScore R$9,90; Validador R$9,90; Platform R$99,90 / R$149,90 / R$199,90 mensais. A tabela existente jenios_pay_products é reutilizada, sem migrações. Alterações usam updated_at para detectar conflito entre duas sessões. Pedidos anteriores mantêm seu valor.

Impulsionamento: produto de orçamento variável, calculado pelo servidor; o cliente deve ser autor do post. Especialistas: comissão de 10%, sem mensalidade fixa inventada; ofertas são mantidas no perfil existente e o preço é lido no servidor. Divisão e repasses efetivos não foram homologados neste ambiente.

## Veracidade do estado

O checkpoint 10 conecta a consulta detalhada de Criptos ao pedido pago: /social/consulta-detalhada?pedido=<UUID> e POST /api/crypto-validator/detailed. O servidor verifica titular, status paid e fingerprint do alvo antes de consultar a rede ou gerar o PDF. A listagem de cobranças expõe apenas o nome/código conhecido do produto, nunca external_reference, alvo ou fingerprint.

Consulta básica e seu PDF continuam disponíveis. A consulta paga acrescenta interpretação estruturada das evidências, limites de finalidade, identidade e titularidade conforme o tipo consultado. Não inclui inventário completo de tokens, varredura patrimonial, auditoria de código ou garantia de liquidez. Não vender esses recursos como concluídos. Litecoin sem provedor homologado não pode gerar nova contratação.

Não há relatório salvo na nuvem. O navegador pode reter os dados do alvo por sessão; se perdidos, o usuário informa exatamente o alvo contratado. Nenhum dado local concede acesso por si só. Nova emissão consulta novamente a fonte e pode observar outro estado. Falha de provedor retorna 503 e permite tentar novamente com o mesmo pedido, sem nova cobrança.

A integração Inter é considerada validada pelo usuário. Este ambiente não homologou a compatibilidade do adaptador com a implementação PAY do Mac nem o retorno real do pagamento. BankScore completo, execução de campanhas, entrega das ofertas e recorrência ativa da Platform continuam pendentes. Não promover este pacote à produção como versão final homologada.
