# R107 — autorização individual Alpaca

Implementação de um serviço HTTP dedicado para o consentimento OAuth de clientes
com conta própria. O saldo permanece na corretora. Nenhum endpoint de ordens,
depósitos, saques, conta coletiva ou custódia foi acrescentado.

## Entrega

- POST de início com sessão Platform e consentimento explícito; token fora da URL.
- Redirecionamento ao domínio oficial Alpaca e retorno fixo em
  `https://connect.jenios.com.br/platform/integracoes/alpaca/retorno`.
- Contexto de retorno cifrado, cookies Secure/HttpOnly, nonce, estado persistido
  de uso único e validade de dez minutos. Códigos não são repetidos em falhas.
- JWT verificado pelo Auth, sujeito correspondente e existência/validade da
  sessão no banco antes das ações sensíveis. Logout impede novas ações.
- Credencial Alpaca cifrada no cofre R83; confirmação inicial usa apenas consultas
  GET da conta e do relógio. Não certifica permissões de negociação.
- Consulta paginada e remoção local exclusivamente pelo titular. O painel informa
  a necessidade de revogar também no fornecedor e que ordens/posições continuam.
- Interface em `/integracoes?provider=alpaca`, desligada por padrão pela variável
  `NEXT_PUBLIC_JENIOS_R107_ALPACA_CONNECT_UI`.
- Listener com limites de corpo, cabeçalhos, concorrência e tempo; sem log de URL,
  corpo, token, cookie, credencial ou conteúdo de exceção.

## Testes e limites

`node --test tests/platformRobotR106AlpacaConnect.test.mjs tests/platformRobotR107ConnectHttp.test.mjs`
executa 27 casos com corretora e identidade sintéticas, incluindo socket HTTP real,
consentimento, replay concorrente, encerramento de sessão, troca de titular,
cookies adulterados, origens indevidas, reconexão e destruição local da credencial.

`scripts/test-r107-connect-session-postgres.mjs` exige banco PostgreSQL vazio,
descartável e em loopback. Verifica privilégios, expiração, titularidade e logout.
Foi preparado no CI, junto da regressão completa e compilação Next.js. O CI
remoto R107 ainda não foi executado: a publicação desse novo módulo no repositório
público foi bloqueada pela revisão automática de aprovação.

A validação local concluiu 1.913 testes gerais + 94 Social/S05 e compilou 81
páginas. A mesma verificação SQL passou em PostgreSQL 18.6 embarcado (PGlite
0.5.11); o servidor PostgreSQL 16 do CI continua pendente. A migração foi aplicada
na Platform, com versão registrada `20261028222707`, e as verificações posteriores
confirmaram: anon/authenticated sem EXECUTE; service_role com EXECUTE; tabela de
sessões sem acesso direto; sessão inexistente recusada. Nenhum aviso novo R107
foi apontado pelos advisors de segurança.

Esses testes não são homologação de conta real. A interface continua desativada
até o serviço, domínio, aplicação aprovada e retorno real serem verificados.

## Implantação do serviço dedicado

1. Usar serviço HTTP Node 22 em Render, em instância única com disco persistente
   de 1 GB em `/var/data/jenios-connect`. Não substituir o worker R100 existente.
   O subdiretório `oauth` é criado com modo 0700 no primeiro início; diretórios
   existentes com permissões incorretas são recusados, nunca corrigidos em silêncio.
2. Build: `npm ci --ignore-scripts --no-audit --no-fund`.
   Start: `node scripts/platform/connections/r107-alpaca-connect-server.mjs`.
   Health: `/healthz`; porta `PORT` fornecida pelo host; autoDeploy desligado.
   Um disco por instância é obrigatório: múltiplas réplicas não compartilham o
   registro de estado OAuth e não são suportadas nesta versão.
3. Migração R107 instalada e verificada no projeto Platform
   `xaicvhagftzjkqphnbgx`, versão `20261028222707`. Social é separada.
4. Configurar domínio/TLS `connect.jenios.com.br`; cadastrar a URI de retorno
   exata acima no aplicativo Alpaca aprovado para contas de terceiros.
5. Inserir no gerenciador seguro do serviço: ID/segredo do aplicativo, chave de
   serviço Platform e três chaves distintas de 32 bytes em base64 (cofre, digest
   e sessão de navegador). Nunca enviar esses valores no chat ou no Git.
6. Aplicar o contrato de ambiente abaixo. Conferir health/configuração, consentimento
   em conta autorizada, recusa, retorno, consulta, logout, revogação e reconexão.
   Somente depois disponibilizar o botão no site.

O serviço não inicializa sem aprovação/configuração; `/healthz` confirma apenas
configuração do serviço, nunca aprovação externa ou operação do robô.

### Contrato de ambiente (valores não secretos)

| Variável | Valor |
| --- | --- |
| PLATFORM_SUPABASE_URL | https://xaicvhagftzjkqphnbgx.supabase.co |
| JENIOS_R107_PUBLIC_ORIGIN | https://connect.jenios.com.br |
| JENIOS_R106_ALPACA_REDIRECT_URI | https://connect.jenios.com.br/platform/integracoes/alpaca/retorno |
| JENIOS_R106_PRIVATE_VOLUME | /var/data/jenios-connect/oauth |
| JENIOS_R107_CONNECT_HTTP_ENABLED | true, somente no serviço dedicado configurado |
| JENIOS_R106_ALPACA_CONNECT_ENABLED | true, somente no serviço dedicado configurado |
| JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED | true somente com aprovação real do fornecedor |
| JENIOS_R83_PRIVATE_NODE_WORKER / JENIOS_R83_LIVE_VAULT_ENABLED | true |
| JENIOS_R82_PRIVATE_NODE_WORKER / JENIOS_R82_ALPACA_LIVE_READ_ENABLED | true |
| JENIOS_R83_LIVE_VAULT_KEY_ID | identificador estável da chave de cofre instalada |
| JENIOS_REAL_EXECUTION_ENABLED / JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED | false |
| JENIOS_R100_INERT_WORKER_ENABLED / JENIOS_R104_PRIVATE_OPERATOR_ENABLED | false |
| JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED / JENIOS_R80_PRIVATE_ISSUER_ENABLED | false |
| JENIOS_PRIVATE_PAPER_EXECUTOR / JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED | false |
| JENIOS_PAY_PAYMENTS_ENABLED / JENIOS_INTER_CHARGES_ENABLED | false |

Variáveis secretas: `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`,
`JENIOS_R106_ALPACA_CLIENT_ID`, `JENIOS_R106_ALPACA_CLIENT_SECRET`,
`JENIOS_R107_BROWSER_SESSION_KEY_B64`, `JENIOS_R83_LIVE_VAULT_KEY_B64`,
`JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64`. Não adicionar `VERCEL`, `VERCEL_ENV`,
`NEXT_RUNTIME` ou variáveis Lambda a esse host. O site Vercel recebe apenas a
flag pública da interface depois da homologação.

## Pendências reais para o lançamento

| Integração | Evidência de código atual | Ainda necessário |
| --- | --- | --- |
| Alpaca | Leitura, cofre, OAuth e serviço de autorização R107; execução Paper separada | Aplicativo de terceiros aprovado/configurado; host/DNS/TLS; conta autorizada; homologação externa; execução Live, limites, reconciliação e parada |
| Binance | Leitura privada e Spot Testnet | Conta/chaves com permissões verificadas; homologação; caminho de execução real e reconciliação |
| Profit, Genial, Clear, XP e BTG | Guias e contratos de terminal | Licenças/roteamento de cada fornecedor; ponte Windows instalada; autenticação e testes ponta a ponta |
| MT5 | Guia e contrato de ponte | EA/ponte instalada e assinada, terminal/corretora, reconciliação e testes |
| cTrader | Guia de OAuth/contas | Aplicação aprovada e conector funcional de mensagens/ordens homologado |
| IBKR | Guia do acesso individual/terceiros | Modalidade aprovada, gateway/aplicação, conector e homologação |
| Mercado Bitcoin e Kraken | Guias/contratos; formatos não equivalem a integração | Conectores autenticados completos, permissões, testes externos e reconciliação |

Os doze guias orientam o usuário, mas não representam doze robôs aptos a negociar.
Os sete dias gratuitos não autenticam a conta, não homologam software e não
protegem contra prejuízo. Nenhum teste desta entrega envia ordem a uma corretora.

## Fontes técnicas verificadas

- https://docs.alpaca.markets/docs/using-oauth2-and-trading-api
- https://supabase.com/docs/guides/auth/sessions
- https://render.com/docs/deploys
- https://render.com/docs/disks
- https://render.com/docs/health-checks

## Estado de publicação

Código R107 concluído para revisão privada; sem publicação no GitHub público e
sem implantação HTTP. A revisão automática bloqueou especificamente o upload
desse módulo, detalhes internos e implementação de segurança no repositório
público. A produção web permanece em `8f1b8e4827814d7efe42dc5b91226def2ea42ad5`,
READY; nenhuma flag de interface ou execução foi ativada. O deploy do serviço
ainda exige aplicativo Alpaca aprovado/configurado, domínio/TLS e credenciais
no gerenciador seguro. Este pacote não é certificado de prontidão Live.
