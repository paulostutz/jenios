# R106 — autenticação individual e orientação dos gênios

O dinheiro para negociação permanece na conta de cada cliente na corretora. A JENIOS fornece software e usa a autorização individual do cliente. Assinatura e teste gratuito não são depósito, autenticação ou aprovação para negociar.

## Entrega

- Os 12 guias existentes recebem requisitos de autenticação, responsabilidade do cliente/JENIOS, consulta versus negociação, situação pendente, canal seguro e explicação sobre o período grátis.
- A mesma base alimenta `/integracoes`, os metadados de `/api/platform/broker-providers`, Gênio, Gênia e o material dos Gênios Pro. Não há treinamento de pesos de modelo; são respostas orientadas por conteúdo revisado. Os dois assistentes usam as mesmas instruções verificadas sem enviar credenciais à IA.
- Perguntas sobre permissões para comprar/vender recebem orientação; ordens de compra/venda e recomendações personalizadas continuam no atendimento restrito. O contexto conserva a corretora em perguntas seguintes sobre autorização.
- Alpaca Connect ganha um núcleo privado de início/retorno OAuth, com consentimento explícito, sessão Platform verificada, vínculo de usuário e navegador, validade de 10 minutos, estado consumido antes da troca de código e persistência SQLite. Retorno concorrente, repetido ou após reinício não troca o mesmo código novamente.
- O token fica no cofre R83 com criptografia e vínculo de titularidade. A confirmação externa usa apenas GET de conta/relógio; nenhum pedido de negociação é enviado. Falha após armazenamento tenta destruir a credencial local. Ambiguidade de rede não gera repetição automática.
- A aplicação solicita apenas o escopo `trading`, que concede permissão de ordens na Alpaca. Essa permissão externa NÃO habilita execução JENIOS: flags Live continuam desativadas e a aprovação de risco continua separada. Não solicita `account:write`, `data` ou saques.

## Limites da entrega e pré-requisitos restantes

O núcleo OAuth é um componente de servidor privado, sem servidor HTTP, rota pública, agendamento ou implantação ativa. Não é um fluxo utilizável por clientes nesta revisão. O caminho de callback previsto ainda precisa ser implementado e registrado; a aprovação da aplicação Alpaca para contas reais de terceiros precisa ser obtida e comprovada. A flag de configuração não constitui evidência dessa aprovação.

O adaptador HTTP futuro deve autenticar a sessão Platform pelo servidor; exigir proteção CSRF e origem na iniciação; exibir o escopo `trading` e sua finalidade antes do consentimento; aplicar o cookie retornado como `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem domínio; nunca serializar o valor desse cookie em JSON; obter o vínculo do cookie, não do corpo arbitrário; validar o callback exato e parâmetros únicos; remover o cookie ao concluir; impedir cache e vazamento do código na URL, logs, analytics e cabeçalho Referer. Deve mostrar erros fixos, não objetos brutos de erro. Sessão inválida interrompe o retorno. Rotação de segredos, retenção/limpeza do diário e revogação no fornecedor ainda exigem procedimento operacional.

O componente recusa execução em Vercel/Next/Lambda, no worker inerte ou junto de executores financeiros. `JENIOS_R106_ALPACA_CONNECT_ENABLED` permanece desativada/ausente nos ambientes publicados. Não se acrescenta segredo ao navegador, repositório ou relatório. Uma falha após a concessão pode exigir que o cliente revogue o aplicativo diretamente na Alpaca, inclusive quando nenhuma credencial local puder ser recuperada.

Binance Testnet e Alpaca Paper possuem leitores de demonstração. Os outros dez fornecedores ainda não possuem conectores autenticados homologados. A presença da orientação na API é metadado de ajuda, não implementação da conexão. Continuam pendentes o fluxo completo de ordens reais, homologação autenticada por fornecedor e restauração de backup externo. Não há certificação de funcionamento sem falhas ou liberação geral para dinheiro real.

## Validação

Verificação local concluída em 28/10/2026: **1.903 testes gerais + 94 Social/S05**, sem falhas; build Next.js aprovado, com **81 páginas estáticas**. Os 33 novos casos R106 estão incluídos nos 1.903 gerais. A página compilada também contém os requisitos de autenticação, responsabilidades, permissões e saldo na corretora.

Testes automatizados usam credenciais fictícias, respostas de corretora simuladas e SQLite/cofre reais. Cobrem os 12 guias nas duas personas; compartilhamento com metadados e Pro; contexto de autorização; separação saldo/assinatura; limites do teste grátis; proteção de credenciais e comandos financeiros; OAuth bem-sucedido; troca de usuário/navegador/aplicação; expiração; concorrência; negação; escopos indevidos; redirecionamento; erros de rede; respostas grandes/inválidas; revogação local após falha; persistência em processo separado; arquivo inseguro; limite de iniciações e recusa de execução em ambiente web.

Não houve autorização externa real, envio/cancelamento de ordem, uso de saldo, alteração de credenciais de clientes ou ativação de robôs nesta validação.

## Fontes primárias

- [Alpaca Connect e aprovação de terceiros](https://docs.alpaca.markets/us/docs/about-connect-api)
- [Alpaca OAuth: URLs, parâmetros e escopos](https://docs.alpaca.markets/us/docs/using-oauth2-and-trading-api)
- [cTrader: autorização da conta](https://help.ctrader.com/open-api/account-authentication/)
- [cTrader: aprovação da aplicação](https://help.ctrader.com/open-api/api-application/)
- [ProfitDLL: licença, dados e roteamento](https://ajuda.nelogica.com.br/hc/pt-br/articles/22396517026203-Ecossistema-ProfitDLL-e-primeiros-passos)
- [MT5: controles do terminal e EA](https://www.metatrader5.com/pt/terminal/help/algotrading/trade_robots_indicators)
- [IBKR: canais e aprovação de terceiros](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/)
- [Binance: segurança da API Spot](https://developers.binance.com/en/docs/products/spot/rest-api)
- [Kraken: permissões Spot](https://support.kraken.com/articles/360000919966-how-to-create-an-api-key)
- [Mercado Bitcoin: API](https://www.mercadobitcoin.com.br/api) — nomes de permissões e detalhes do conector ainda precisam de confirmação; nenhuma opção de escopo não verificada foi criada no guia.
