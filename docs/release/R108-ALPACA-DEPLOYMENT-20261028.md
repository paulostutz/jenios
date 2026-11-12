# R108 — implantação da conexão Alpaca

## Resultado de 28/10/2026

Os backups R51–R60 e a publicação R73 já comprovam validação de pesquisa dos
quatro modos. Nenhum motor foi recriado nesta etapa. O R107 também já passou
no CI remoto, incluindo a verificação de sessões em PostgreSQL 16.

A inspeção atual encontrou somente o worker JENIOS R100 no Render; não existe
o serviço HTTP dedicado de autorização. Na consulta de nomes de variáveis do
projeto web Vercel e do processo local, não foram encontrados Client ID/Secret
Alpaca nem a configuração R106/R107. Os valores de variáveis do worker Render
não foram consultados; não se pode concluir que credenciais estejam ausentes
de todos os ambientes.

## Correção e configuração entregues

- O início do R107 agora valida as três chaves criptográficas e o identificador
  do cofre. Chaves ausentes, malformadas, não canônicas ou reutilizadas impedem
  a inicialização e a resposta positiva do health check, antes de consumir um
  código OAuth. Antes, duas dessas chaves só eram verificadas durante o retorno.
- `render-alpaca-connect.yaml`: serviço Node 22 com uma instância, disco de 1 GB,
  health check, desligamento gracioso, origem e callback fixos. Nenhum recurso
  existente é definido nesse arquivo. Auto-deploy e previews estão desligados.
- Três segredos internos são gerados pelo Render na criação. ID/segredo Alpaca
  e chave de serviço Platform são preenchidos pelo gerenciador seguro. A
  aprovação Alpaca não é presumida nem inserida automaticamente.

## Dados externos necessários

No [painel Alpaca](https://app.alpaca.markets), acessar Connect → My Developed
Apps e usar o aplicativo JENIOS existente; criar um novo somente se não houver
cadastro. Conferir a URI registrada:

`https://connect.jenios.com.br/platform/integracoes/alpaca/retorno`

As credenciais devem ser cadastradas diretamente no Render, nunca no chat ou
no repositório:

| Campo do serviço | Origem |
| --- | --- |
| `JENIOS_R106_ALPACA_CLIENT_ID` | Client ID do aplicativo Alpaca |
| `JENIOS_R106_ALPACA_CLIENT_SECRET` | Client Secret do mesmo aplicativo |
| `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` | Projeto Platform, nunca o Social |
| `JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED` | `true` somente após aprovação efetiva da Alpaca para contas de terceiros |

Antes de gerar um cofre novo, verificar se existem conexões R83 vigentes. Se
existirem, preservar a chave, o identificador e a chave de digest já utilizados.
Não substituir chaves de conexões existentes pela geração de uma nova chave.

## Implantação quando esses dados estiverem disponíveis

1. No Render, criar um Blueprint do repositório `paulostutz/jenios`, branch
   `fix/jenios-r80-private-paper-safety-20261027`, usando o caminho
   `render-alpaca-connect.yaml`. Conferir que a prévia contém apenas o novo
   serviço `jenios-alpaca-connect` e seu disco. Esse serviço usa plano pago.
2. Preencher os campos acima no gerenciador seguro. Para um cofre novo, o Render
   gera as três chaves base64 de 32 bytes. Não gerar ou rotacionar novamente em
   cada implantação. O campo `sync: false` só solicita valores na criação.
3. Configurar o DNS de `connect.jenios.com.br` com o destino fornecido pelo novo
   serviço e esperar a confirmação de domínio/TLS. Não alterar o domínio do site.
4. Conferir inicialização e `/healthz`, que só informa prontidão de configuração.
   Executar consentimento/recusa/retorno/logout/reconexão com conta autorizada.
   A leitura da conta não comprova envio ou execução de ordens.
5. Somente após a conexão ser verificada, disponibilizar o botão de conexão no
   frontend correspondente. Isso ainda não ativa os quatro robôs em conta real.

## O que ainda não foi concluído

Serviço HTTP implantado, DNS/TLS do callback, credenciais/aprovação efetiva da
Alpaca, retorno de uma conta externa e validação do caminho motor → ordem final
→ corretora → confirmação/posição. Estes itens continuam pendentes; o Blueprint
e os testes sintéticos não equivalem a uma liberação para dinheiro real.

O modo Reverso deve entregar a direção final antes do envio, preservando as
exceções já homologadas do motor. O executor não deve inverter novamente.
O patrimônio do cliente continua na própria corretora.

## Verificação desta alteração

Os 29 testes focados R106/R107 passaram, incluindo os dois novos cenários de
configuração incompleta/inválida. O Blueprint passou no JSON Schema atual do
Render e no validador da configuração R107 usando credenciais sintéticas e
diretório local de teste. Não houve chamada à corretora nem operação real.
O schema valida a estrutura do arquivo; criação, cobrança, domínio e disco
reais ainda dependem da aplicação do Blueprint no Render.

A regressão local completa também passou: 1.915 testes gerais + 94 Social/S05,
com `npm run build` concluído e 81 páginas estáticas geradas. Os 29 testes focados
estão incluídos no total geral. Execução local em Node 24.22.1; o Blueprint usa
Node 22, correspondente ao CI remoto existente. O novo CI remoto ainda não rodou.

## Publicação desta alteração

A criação do tree no GitHub foi recusada pela revisão automática de aprovação:
o repositório é público e o novo pacote contém código e documentação interna de
autenticação/implantação, incluindo identificadores de infraestrutura. A revisão
considerou que a autorização geral para prosseguir não especificava a publicação
deste novo conteúdo. Nenhuma atualização de branch foi feita para o R108.

A alteração foi mantida localmente e preparada como pacote privado para revisão.
O novo CI remoto depende da publicação; não reutilizar o sucesso do CI R107 como
se fosse uma execução sobre o código R108.

## Referências verificadas

- [Render Blueprint](https://render.com/docs/blueprint-spec)
- [Disco persistente](https://render.com/docs/disks)
- [Variáveis e segredos](https://render.com/docs/configure-environment-variables)
- [Versão Node](https://render.com/docs/node-version)
- [Cadastro do aplicativo Alpaca](https://docs.alpaca.markets/us/docs/registering-your-app)
- [Condições de Connect](https://docs.alpaca.markets/us/docs/about-connect-api)
