# JENIOS G48 — Banco Inter no Vault e configuração Master

## Objetivo

Instalar a infraestrutura bancária que faltava para a JENIOS receber e validar, com isolamento, as credenciais de produção do Banco Inter. A entrega não habilita cobranças, não cria pedidos e não movimenta dinheiro.

## Base preservada

- Release integrada: `release/jenios-genios-g44-20261024`
- Base G47: `dec6ae5965b443ed0b8baabf05f750e33b403067`
- Árvore certificada G47: `1adba07a869ecd798455bd0805e50a9d5500b58d`
- Regra comercial preservada: mensalidade Platform por Pix mensal, com renovação manual e liberação somente após confirmação bancária.
- Gênio/Gênia Pro, Universidade, Social, e-mails e mecanismos de acesso permanecem com seus gates próprios.

## Entregas

1. **Cofre isolado**
   - Segredo exclusivo `jenios_g48_inter_pix` no Supabase Vault da JENIOS.
   - Nenhuma reutilização de credenciais do CHEFE ou da LETTER.
   - Client Secret, certificado e chave privada não são devolvidos ao navegador, logs ou auditoria.

2. **Configuração pela conta Master**
   - Painel em `/admin/cobrancas`.
   - Entrada de Client ID, Client Secret e ZIP original do Banco Inter.
   - Validação local do ZIP, certificado, chave privada, correspondência criptográfica e validade.
   - Chave Pix e número da conta podem ser preenchidos no painel; a chave Pix já protegida no ambiente pode ser reaproveitada sem exposição.

3. **Conexão segura antes do salvamento**
   - OAuth mTLS com as credenciais informadas.
   - Consulta Pix somente por `GET` com txid sintético.
   - Nenhum `PUT`, criação de cobrança ou movimentação durante a configuração.
   - Gravação atômica somente após o banco confirmar a autenticação e o acesso de leitura.

4. **Proteções operacionais**
   - Rate limit durável para conectar e retestar.
   - Controle de versão e fingerprint para impedir sobrescrita concorrente.
   - RLS e RPCs restritas ao `service_role`.
   - Resolução server-side das credenciais para mensalidade Platform, Universidade, créditos Pro e checkout Social.
   - Consultas de pedidos existentes podem continuar durante uma pausa; novas cobranças exigem dois gates independentes.

## Gates de cobrança

Uma nova cobrança Inter somente pode ser emitida quando todos estes requisitos forem verdadeiros ao mesmo tempo:

- `JENIOS_PAY_PROVIDER=inter_pix`
- `JENIOS_PAY_PAYMENTS_ENABLED=true`
- `JENIOS_INTER_CHARGES_ENABLED=true`
- configuração Vault existente, válida e autenticada no Inter
- gate específico do produto habilitado

Na instalação G48, `JENIOS_INTER_CHARGES_ENABLED` permanece **false**. Portanto, cadastrar ou testar as credenciais não gera cobrança.

## Migração de banco

Arquivo: `supabase/migrations/20261025013000_jenios_g48_inter_vault_setup.sql`

A migração cria apenas a estrutura protegida, metadados não secretos, limites de tentativa e RPCs. Ela não insere credenciais, não cria segredo vazio, não cria pedido, não registra pagamento e não habilita qualquer gate.

## Certificação

- testes unitários e de integração do serviço, rota, ZIP, Vault, concorrência e gates;
- regressão PostgreSQL 17 descartável, com segredo sintético e rollback integral;
- suíte integral do repositório e build Next.js na CI;
- backup exato da fonte, commit e checksum;
- implantação sem promoção de domínios para smoke test antes da integração deliberada.

## Ativação posterior

A emissão real deve continuar bloqueada até que a conta Master:

1. informe o Client ID e o Client Secret da integração de produção;
2. envie o ZIP original emitido pelo Banco Inter;
3. confirme a chave Pix recebedora;
4. obtenha o estado “conexão confirmada” no teste somente leitura;
5. conclua a homologação de uma cobrança controlada e explicitamente autorizada;
6. habilite deliberadamente os gates de cobrança.
