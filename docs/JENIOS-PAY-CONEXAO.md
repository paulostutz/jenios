# Conexão da interface V7 à JENIOS PAY existente

## Escopo deste código

O Banco Inter e os webhooks existentes não são substituídos. Este bloco implementa catálogo, edição administrativa de preços, consultas de pedidos e um adaptador HTTP para encaminhar contratações à PAY.

O adaptador é um contrato novo na fronteira da Social: ainda deve ser compatibilizado com o endpoint real da instalação PAY do usuário. Não é evidência de compatibilidade já verificada nem de pagamento real executado.

## Configuração server-side

- JENIOS_PAY_CHECKOUT_URL: URL HTTPS exata do endpoint existente de criação de checkout.
- JENIOS_PAY_API_TOKEN: credencial própria desse endpoint. Não reutilizar certificados, chave privada do Inter ou token administrativo.
- JENIOS_PAY_CHECKOUT_ORIGINS: origens HTTPS adicionais autorizadas para redirecionar ao checkout, separadas por vírgula. A origem do endpoint já é autorizada.
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

Impulsionamento: produto de orçamento variável, calculado pelo servidor; o cliente deve ser autor do post. Especialistas: comissão de 10%, sem mensalidade fixa inventada; ofertas, divisão e repasses não são implementados neste bloco.

## Veracidade do estado

Este bloco não afirma conclusão do ciclo financeiro real nem da entrega paga de laudos/campanhas. PDFs de homologação existentes continuam disponíveis; a concessão paga por consulta e a distribuição efetiva de anúncios permanecem pendentes da compatibilização com a PAY. Não promover este pacote à produção como versão final homologada.
