# JENIOS — B282–B284: agentes comerciais, planos e configuração bancária

**Data:** 21/10/2026. **Base** B281 `2633bb6654c64bb956207fd28605e4ac30888380` (CI 39631213261, SUCCESS). Produção original B177-R3 permanece intocada.

## Objetivo aprovado
Aproveitar o produto pronto, sem reconstrução. Unificar Gênio/Gênia como **atendimento comercial e suporte** na JENIOS Social (visitante ou logado), na landing page `/lp` e na Platform para usuários sem planos. IA generativa responde dúvidas e apresenta os três planos, auxiliando até o checkout; **não pode criar pedidos, assinar contratos, realizar transações, vender promessa de rentabilidade ou recomendar operações**.

## Atendimento de vendas
`/api/assistant/free` passa a ter uma camada de IA generativa opcional com material da plataforma e planos aprovados: Nacional R$99,90, Global Crypto R$149,90, Internacional Pro R$199,90. O usuário não compra tokens nem necessita cadastrar conta para falar com o agente; os personagens continuam selecionáveis. A IA só é chamada após reserva atômica no banco `jenios_sales_budget_hold_b282`, limitando gasto global mensal e uso por origem pseudonimizada (máx. 12 chamadas por hora por hash). Sem credenciais OpenAI, modelo, salt, tabela/RPC ou saldo autorizado, utiliza resposta comercial guiada local, **sem consumir IA e sem expor erro interno**.

Configuração de servidor necessária, somente em ambiente autorizado: `JENIOS_SALES_GENERATIVE_ENABLED=true`, `JENIOS_SALES_MODEL` modelo aceito pelo provedor, `OPENAI_API_KEY` guardada no backend, `JENIOS_SALES_VISITOR_SALT` segredo aleatório de pelo menos 32 caracteres, `JENIOS_AI_MONTHLY_BUDGET_USD` orçamento mensal (≥ US$1, ≤ US$1.000). Nenhum valor financeiro ou segredo é escrito no GitHub ou chat. Respostas com falha, cobranças falsas, sinais e afirmações impróprias retornam atendimento guiado. O próprio modelo e a disponibilidade comercial precisam ser confirmados no ambiente alvo.

## Regras dos Gênios avançados
Recurso exclusivo de **plano ativo Global Crypto (R$149,90) ou Internacional Pro (R$199,90)**; usuário Nacional sem plano superior recebe 402 no servidor, independentemente do estado do formulário e de créditos antigos. Apenas origem de franquia incluída é autorizada para novas consultas Pro, com livro de consumo e limite mensal interno mantidos como controle de orçamento. Os três endpoints de compra, status e cotação de novos créditos avulsos agora bloqueiam com HTTP 410. O histórico financeiro anterior permanece preservado para auditoria (não é apagado). UI é simplificada, sem compra de créditos nem consulta contínua de tokens. As leituras de gráficos continuam informativas, sem ordens nem sinais personalizados.

## Integração Banco Inter para o Master
A tela existente `Admin > Cobranças > Conexão Inter` inclui um formulário para:
- Client ID, Client Secret, ZIP original do banco contendo **um** par certificado/chave privada, chave Pix e conta opcional.
- Parser ZIP em memória derivado da lógica testada no CHEFE CP304 (reaproveita **apenas o algoritmo**, nunca banco, segredos ou identificações do CHEFE). Rejeita zip-slip, symlink, criptografados, CRC incorreto, duplicidade, senha, explosão de compressão, chaves ambíguas ou divergentes e certificados expirados.
- Armazenamento cifrado no **Supabase Vault exclusivo da JENIOS Social**, por RPC `service_role` com RLS, sem retorno de credenciais ao navegador. Administração Master via `finance.manage` confirmada no backend, auditoria e origem verificada.
- Botão de teste explícito solicita OAuth mTLS e consulta **GET** de txid inexistente. Não emite cobrança, não altera pagamentos e deixa `chargesEnabled=false` até homologação.
- **Novas configurações não ativam cobrança por si só**. O checkout existente do Inter pode consultar as credenciais armazenadas apenas com `JENIOS_PAY_PROVIDER=inter_pix` e `JENIOS_INTER_CHARGES_ENABLED=true` habilitados especificamente após testes. A modalidade recorrente da Platform continua bloqueada enquanto não tiver confirmação de pagamentos e atualização efetiva de assinaturas.

A migração `20261021170000_jenios_b282_b283_sales_inter_vault.sql` deve ser aplicada **primeiro no projeto JENIOS Social de homologação**, jamais no CHEFE, LETTER ou no banco de produção sem validação/autorizações. O cofre não confere validade bancária sozinho. Não foram enviadas credenciais nem criadas transações com bancos reais neste bloco.

## Planos: remoção de Pix fixo
A página legada `/planos` exibia Pix estáticos independentes do pedido e continha recebedor associado a outra empresa. Agora redireciona para o checkout versionado `/checkout`, que consulta catálogo oficial e cria pedido com idempotência no servidor. A integração de Pix avulso da Social é mantida, mas ativação/assinaturas Platform com Inter Pix ainda exigem implementação/homologação do ciclo completo.

## Homologação e etapas pendentes
CI verifica o escopo (13 arquivos adicionados, 18 modificados), testes adversariais de ZIP e identidade, proteções de plano e cobranças, testes gerais (Social S05), Next.js build. **CI verde não prova**: conexão bancária real, gateway sandbox oficial, webhook/renovação, modelo IA real em produção, autenticação end-to-end das três superfícies, emissor do Pix ou permissão de operação. Permanece pendente configuração de segredos em Preview protegido, testes do banco com autorização, integração de cobranças mensais, controle de assinatura/trial, revisão jurídica e deploy controlado.

## Backups e ambiente
Branch `fix/jenios-b282-b284-sales-assistants-inter-20261021`; backup certificado somente após CI integral verde e relatório explícito. Projeto Vercel original `jenios-ecossistem` e domínios jenios.com.br/www preservados; Social, Universidade, PAY histórico, BankScore, Validador, núcleo proprietário e projetos Letter/Chefe não são alterados fora deste escopo.

## Homologação adicional B284-R2
Chromium localhost em 1280, 390, 360 e 320 px: entrada na LP, escolha Gênio, pergunta do plano R$149,90 com fallback sem custo, CTA para checkout, suporte dentro da Platform e redirecionamento da página antiga de Pix. Nenhuma credencial, pedido ou cobrança reais. Os módulos de pesquisa continuam isolados.
