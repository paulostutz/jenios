# JENIOS B170 — consolidação técnica e publicação controlada (20/10/2026)

## Base
B169: a9bccb96b3b2c5052de66af703d9266b98835941. Produção anterior B160: dc320f8fcbec74d2ea1dcf923bed923bdf4377d9, deploy dpl_3Y6pNQ3MwNHVxpzxfCiAe95Xtbob.

## Aditivos de consolidação
- API `GET /api/platform/broker-providers`: lista pública factual de 12 fornecedores e estado de implementação, sem credenciais e sem chamar corretoras.
- Apenas Binance Spot Testnet e Alpaca Paper apresentam leitura demonstrativa implementada. Ativação depende de configuração privada, cofre criptográfico e consentimento explícito.
- Anúncio da etapa técnica na Central /integracoes, separando guias, leitor demo e execução de ordens.
- Testes que impedem anunciar uma conexão real ou negociação por confusão entre guia e capacidade.

## Proteções mantidas
- Banco da Platform QA `xaicvhagftzjkqphnbgx`, tabelas de conexões/limites com RLS, sem acesso direto por clientes.
- Cofre AES-256-GCM somente no servidor; flags e chaves de integração DEMO não habilitadas em produção.
- Na produção, o cadastro de credenciais permanece intencionalmente indisponível até piloto Testnet/Paper autenticado com usuário real, permissão verificada e vault configurado em canal protegido.
- GET-only para as corretoras; sem instalação de terminal/DLL/EA, sem roteamento, inclusão, cancelamento ou execução de ordem, depósito, custódia e saques.
- B164 e B169 são fontes públicas aprovadas, sem núcleos privados. Não misturar JENIOS PAY, BankScore, Social, Universidade, Letter ou Chefe.

## Critérios para liberação comercial do autosserviço
1. Validar a origem exata da sessão JENIOS Platform e fluxo real no navegador com conta de teste voluntária.
2. Configurar cofre no Vercel em segredo server-only, de preferência com integração gerenciada e rotação/recuperação; nunca por chat nem repositório.
3. Confirmar leitura externa de conta, limites, bloqueios, clock, permissões da chave, reconciliação e revogação.
4. Executar revisão de segurança, telemetria sem segredos, retenção mínima e integração isolada de incidentes.
5. Solicitar autorização separada para qualquer liberação de dinheiro real ou ordem, inclusive demonstrativa.
