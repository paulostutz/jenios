# JENIOS G46 — ATIVAÇÃO FINAL DA IA PRO E CATÁLOGO

**Projeto:** JENIOS Platform  
**Repositório:** `paulostutz/jenios`  
**Data da execução:** 24/10/2026, horário de São Paulo  
**Status do bloco:** concluído com ativação da IA Pro; transporte financeiro real preservado fechado por ausência das credenciais bancárias completas de produção.

---

## 1. Versão de código publicada

- **Branch de release:** `release/jenios-genios-g44-20261024`
- **SHA publicado:** `9c8493ebbdb99002271ae6292d475facfa1ad4bf`
- **PR integrada:** `#9 — Complete approved AI add-on catalog and payment guards on published G45`
- **Deployment promovido:** `dpl_BbNqChBy8o3zCPneQuaqdBZE7agP`
- **URL técnica:** `jenios-ecossistem-9rud6qqaq-jenios.vercel.app`
- **Domínios promovidos:**
  - `www.jenios.com.br`
  - `jenios.com.br` → redirecionamento permanente para `www`
  - aliases oficiais do projeto Vercel

A promoção utilizou a build exata já validada, sem reconstrução posterior.

---

## 2. Certificação da integração G46

Execuções GitHub Actions aprovadas:

- `40146273563` — JENIOS G46 integrated verification
- `40146273567` — JENIOS G44 assistant activation

Resultado da build de publicação:

- **94/94 testes de release:** aprovados
- **0 falhas**
- **0 testes ignorados**
- compilação Next.js 15.5.28 aprovada
- **81/81 páginas** geradas
- funções serverless criadas com sucesso
- nenhum erro de build

Artefato certificado:

- **Artifact ID:** `12581221498`
- **Arquivo:** `JENIOS_GENIOS_G46_BACKUP_20261024.zip`
- **SHA-256:** `bb852f8e6bbfab3e1578acc2cd0508f6c15063b9fbe8945da0dc6570e0b77c6b`

---

## 3. Ativação da IA Pro

A geração Pro foi ativada tanto no ambiente de produção quanto no banco final.

### Vercel — produção

- `JENIOS_PRO_GENERATION_ENABLED=true`
- `JENIOS_SALES_GENERATIVE_ENABLED=true` — preservado ativo
- `JENIOS_ASSISTANT_MEMORY_ENABLED=true` — preservado ativo
- `JENIOS_G44_SCHEMA_CERTIFIED=true`
- `JENIOS_AI_MONTHLY_BUDGET_MODE=uncapped`
- `OPENAI_API_KEY` presente como segredo de produção
- `JENIOS_PRO_QUOTE_SECRET` presente
- `JENIOS_ASSISTANT_SESSION_SECRET` presente
- `JENIOS_SALES_VISITOR_SALT` presente

### Supabase — produção

Projeto correto: `igayfjorjmucthlfoasf`

Estado final de `jenios_pro_config_b143`:

- `generation_enabled=true`
- `payments_enabled=false`
- `pricing_version=2026-10-20-v2-nano`
- `pricing_approved=true`
- `rates_verified_at=2026-10-25T00:38:22.173747+00:00`
- modelos autorizados:
  - `gpt-6-luna`
  - `gpt-6.1-sol`
- `monthly_budget_mode=uncapped`
- `monthly_provider_limit_nano_usd=0`
- limite máximo interno por solicitação: `200000000 nanoUSD`, equivalente a US$ 0,20 de custo do provedor
- franquia Global Crypto: `4000000000 nanoUSD`
- franquia Internacional Pro: `8000000000 nanoUSD`
- `commercial_terms_version=jenios-pro-addons-3x-20261024`
- `requires_reconciliation=false`

A função G46 de criação de cotação adicional está instalada e restrita:

- RPC G46 presente
- constraint de integridade G46 presente
- execução permitida ao `service_role`
- execução negada diretamente ao papel `authenticated`

---

## 4. Catálogo comercial configurado

Os três produtos mensais foram criados e confirmados como ativos no banco final:

| Código | Produto | Valor mensal | Estado |
|---|---|---:|---|
| `platform-nacional` | Nacional — B3 | R$ 99,90 | ativo e configurado |
| `platform-global-crypto` | Global Crypto — B3 + Cripto | R$ 149,90 | ativo e configurado |
| `platform-internacional-pro` | Internacional Pro | R$ 199,90 | ativo e configurado |

O produto técnico `social-ai-pro-credits` permanece inativo e com valor zero porque o transporte de cobrança real ainda está fechado. A tabela comercial G46 e suas regras estão implantadas, mas não geram cobrança enquanto os gates bancários estiverem desligados.

---

## 5. Pagamentos reais — bloqueio operacional preservado

A autorização do proprietário foi registrada e aplicada aos recursos que possuem credenciais válidas de produção. A cobrança real não foi ligada porque a produção contém apenas:

- `JENIOS_PAY_PROVIDER=inter_pix`
- `INTER_PIX_KEY` presente

Faltam no ambiente de produção os quatro componentes indispensáveis para autenticação mTLS e emissão pelo Banco Inter:

1. `INTER_CLIENT_ID`
2. `INTER_CLIENT_SECRET`
3. `INTER_CERTIFICATE`
4. `INTER_PRIVATE_KEY`

Foram localizadas credenciais com esses nomes somente em branches antigas de Preview, identificadas explicitamente como **sandbox**, **sem acesso financeiro real** e **não autorizadas para produção**. Elas não foram copiadas nem reaproveitadas.

Também foi verificado que não existe outro conjunto de credenciais bancárias de produção armazenado no Supabase, em buckets de Storage, na biblioteca de arquivos ou nos e-mails conectados pesquisados.

Por segurança, os três gates permanecem explicitamente fechados:

- `JENIOS_PAY_PAYMENTS_ENABLED=false`
- `JENIOS_PRO_PAYMENTS_ENABLED=false`
- `JENIOS_INTER_CHARGES_ENABLED=false`

Ativar esses gates sem o conjunto bancário completo faria o checkout aceitar intenção comercial sem capacidade segura de emitir e conciliar a cobrança. O bloqueio é, portanto, operacional e não uma falta de autorização.

---

## 6. Validação privada e pública

### Build privada exata

- `/api/assistant/free`: HTTP 200
- `/api/jenios-pay/health`: HTTP 200, banco conectado
- `/api/jenios-pay/products?scope=platform`: HTTP 200
- os três produtos retornaram `configured=true`
- `/api/assistant/pro/credits/status`: bloqueio esperado `PRO_PAYMENTS_DISABLED`
- `/genios-pro`: HTTP 200
- nenhum log `error`, `fatal` ou `warning` no runtime

### Após promoção pública

Os mesmos testes foram repetidos em `www.jenios.com.br`:

- assistente gratuito preservado
- banco PAY conectado
- catálogo dos três planos configurado
- pagamentos e checkout real ainda bloqueados
- créditos adicionais bloqueados pelo código correto `PRO_PAYMENTS_DISABLED`
- página Gênio Pro/Gênia Pro servida pelo deployment `dpl_BbNqChBy8o3zCPneQuaqdBZE7agP`
- nenhum erro, fatal ou warning no runtime

Não foi criada uma assinatura sintética nem realizada uma solicitação paga de modelo em produção. Assim, a infraestrutura, os gates e a geração para contas elegíveis estão ativos, mas nenhum custo de IA foi provocado apenas para produzir evidência artificial.

---

## 7. Ausência de efeitos colaterais

Contadores finais no banco de produção:

- pedidos: **0**
- pagamentos: **0**
- assinaturas: **0**
- entitlements: **0**
- cotações Pro: **0**
- solicitações Pro: **0**
- carteiras Pro: **0**
- períodos Pro: **0**

Também permaneceram desligados e inalterados:

- ordens reais de negociação
- transporte Paper privado
- executor Paper
- analista pago dos robôs

---

## 8. Backups e rollback

Branches preservadas:

- `backup/jenios-before-g46-activation-20261024`
- `backup/jenios-g46-production-ai-active-20261024`

Rollback da aplicação anterior:

- deployment anterior: `dpl_AdpVnf6hVpkwGtr17ytsG87LAtLz`

Deployment atual:

- `dpl_BbNqChBy8o3zCPneQuaqdBZE7agP`

A atribuição automática de domínios permanece desligada. Novos pushes ou previews não substituem os domínios públicos sem promoção deliberada.

---

## 9. Observação operacional

A chave OpenAI de produção está registrada no projeto com indicação de renovação antes de **23/11/2026**. Nenhum valor secreto foi incluído neste checkpoint.

---

## 10. Estado final

**Concluído e ativo:**

- integração G46 publicada
- IA Pro autorizada no ambiente e no banco
- memória preservada ativa
- agente comercial generativo preservado ativo
- modelos e preços internos aprovados
- franquias Global Crypto e Internacional Pro configuradas
- catálogo dos três planos configurado
- domínios públicos promovidos
- validação privada e pública aprovada
- backups e rollback preservados

**Única pendência externa:** instalar e validar as quatro credenciais de produção do Banco Inter. Até isso ocorrer, cobranças reais, créditos adicionais e checkout financeiro permanecem corretamente bloqueados.
