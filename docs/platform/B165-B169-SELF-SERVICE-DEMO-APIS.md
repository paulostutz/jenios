# JENIOS Platform — B165–B169: conexão individual por API, piloto somente demonstrativo

Data: 20/10/2026. Branch privada de homologação (fonte pública sem chaves). B160 permanece produção.

## Modelo de negócio preservado

O cliente opera na própria corretora pelo frontend da JENIOS, com tecnologias e robôs próprios licenciados. A JENIOS não recebe depósitos, não realiza custódia, não administra recursos ou saques de clientes. API não é conta de pagamentos JENIOS PAY. Conectar uma conta, obter licença de uso de terminal, validar comunicação e permitir execução financeira são fases distintas. A existência de um guia não implica conector ativo ou autorização regulatória/comercial.

## O que este checkpoint efetivamente entrega

- **B165:** cofre AES-256-GCM com chave aleatória de 32 bytes somente no servidor. Contexto autenticado de criptografia vinculado ao UUID do usuário, conexão, fornecedor, ambiente e tipo de dado. Digest HMAC da identidade externa sem identificador bruto no banco. Testes de adulteração e troca de proprietário.
- **B166:** leitor Binance Spot Testnet (hora, account, openOrders) e Alpaca Paper (account, positions, orders?status=open). Três chamadas GET permitidas por fornecedor, hosts fixos, HTTPS, sem redirects, sem POST/DELETE/PATCH aos fornecedores, sem ordens e com resposta limitada. Binance Spot saldos são reportados como *saldos spot*, não como posições de futuros. Verificação de permissões da chave permanece pendente — retorno de canTrade da conta não equivale a permissão testada.
- **B167:** vínculo por usuário autenticado da Platform, registro cifrado em tabela isolada, identidade externa e ambiente, sincronização com controle de concorrência e intervalo mínimo de 120 segundos e limite de uma tentativa de cadastro de API por minuto, relatório conservador de divergências e revogação com apagamento do cofre local. Para revogar a chave *no fornecedor*, o cliente precisa entrar na própria corretora. Não encerra posições nem cancela ordens.
- **B168:** API HTTP Next.js autenticada com bearer da Platform, validação remota `auth.getUser(token)` no banco **exclusivo da Platform**, guarda de origem HTTP, limites de requisição, respostas sem credenciais e endpoints `GET/POST /api/platform/broker-connections`, `POST /api/platform/broker-connections/:id/sync` e `DELETE /api/platform/broker-connections/:id`. Controles desligados em Production independentemente da configuração do flag.
- **B169:** painel de configuração individual em `/integracoes`, **renderizado apenas quando o flag de interface privada estiver ativo**; autenticação prévia da Platform, API Key e Secret mascarados, consentimento expresso, status de leitura, sincronizar, desconectar e dicas de segurança. Os guias dos outros 10 fornecedores permanecem disponíveis, sem fingir um conector ativo.

## Escopo da infraestrutura

Supabase existente `jenios-platform-homologacao` (ref `xaicvhagftzjkqphnbgx`), sem contratar outro serviço. Migration QA-only em `supabase/review/20261020_jenios_platform_broker_demo_B165_B169_QA_ONLY.sql`. Não executar no banco Social. Tabela RLS habilitada, sem policies para `anon` ou `authenticated`; concessão direta apenas à service_role server-only. Chaves e snapshots cifrados com AES-256-GCM antes de persistir; cliente recebe metadados limitados, sem IDs externos, segredos, snapshots completos ou ordens executáveis.

Na configuração server-side de uma Preview privada da Vercel, depois que a migração QA estiver comprovada, configurar:

- `JENIOS_DEMO_CONNECTORS_ENABLED=true` (somente Preview/Local; Production sempre bloqueia)
- `JENIOS_DEMO_VAULT_KEY_B64=<32 bytes aleatórios em base64 gerados diretamente no provedor de segredos>` — variável **apenas de servidor**, sem `NEXT_PUBLIC_` e sem log.
- `NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI=true` (Preview privativa; production desligada)
- `PLATFORM_SUPABASE_URL` + `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` já existentes, escopo único do Supabase QA, nunca expor no frontend.

**Não copiar chaves por chat nem GitHub.** No piloto de navegador, entrar com conta da Platform e inserir chave TESTNET/PAPER diretamente no campo HTTPS. A produção B160 não recebe ou solicita credenciais até autorização e verificação técnica futuras.

## Como o cliente utiliza (quando habilitado em QA)

1. Acessa a JENIOS Platform com a conta própria e abre `/integracoes`.
2. Seleciona Binance Spot Testnet ou Alpaca Paper. Para as outras corretoras, lê o guia e aguarda conector específico.
3. Cria uma credencial **do ambiente de teste**, de leitura e preferencialmente sem permissão de negociação/saques no fornecedor, conforme as opções da conta; nunca utiliza credencial Live neste módulo.
4. Digita API Key e Secret **na página protegida**, confirma consentimento e clica em **Validar e vincular minha conta de teste**.
5. A JENIOS faz até três GETs allowlisted, autentica a resposta, vincula usuário/ambiente e salva dados cifrados; retorna somente contagem e horário de leitura. Sem conta testada, nenhum vínculo é declarado.
6. Pode sincronizar depois de ao menos 120 segundos. Mudanças de ordens abertas não são automaticamente classificadas como ordens executadas/canceladas. Se a API passa a apontar para outra conta, a JENIOS interrompe a reconciliação.
7. Pode desconectar: o cofre local é apagado, mas deve revogar a chave também na corretora. Para reconectar, exige nova leitura autenticada e novo consentimento.

## Não concluído ou não certificado

- Nenhuma chave Testnet/Paper real foi inserida nem conta externa foi autenticada pelo operador neste checkpoint; os ensaios usam fixtures fictícias.
- Não foi certificado fluxo completo de navegador com sessão real de usuário e chave oficial de teste.
- Não há OAuth para corretoras que o exigem, ponte Windows/DLL para Profit/Nelogica, Expert Advisor MetaTrader, terminal cTrader/IBKR ou demais 10 conectores.
- Não há **roteamento, inclusão, cancelamento ou execução** de ordens reais/demonstrativas pela JENIOS; `GET` não é execução.
- Permissões efetivas por chave, vínculo de titularidade civil, consistência prospectiva, limites intradiários e reconciliação pós-execução precisam de piloto separado.
- Chaves com permissões de negociação eventualmente concedidas *no fornecedor* não alteram o fato de que esta versão JENIOS só possui métodos de leitura.
- Não há alteração nos núcleos de robôs, limites de risco B149–B154, Social, BankScore, Validador, PAY, TradingView, Pro ou Universidade.

## Fontes oficiais para conectores piloto

- Binance Testnet REST: https://developers.binance.com/en/docs/products/spot/testnet/rest-api
- Alpaca autenticação: https://docs.alpaca.markets/us/docs/authentication
- Alpaca Paper positions: https://docs.alpaca.markets/us/reference/getallopenpositions
- Alpaca Paper open orders: https://docs.alpaca.markets/us/reference/getallorders-1
