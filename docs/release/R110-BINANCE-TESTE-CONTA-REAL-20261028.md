# JENIOS — iniciar a conferência da conta Binance real

Este pacote permite testar **conexão, autenticação, permissões e validação de uma
ordem limitada** na sua conta Binance Spot. O teste de ordem usa o endpoint oficial
`/api/v3/order/test`, que não encaminha a ordem para negociação. Não ativa os robôs.

## O que preparar

1. Um computador com Node.js 22 ou superior. O verificador é compatível com Mac,
   Windows e Linux e não precisa instalar dependências npm.
2. Seu UID, consultado no painel oficial da Binance. Esse UID será comparado com a
   conta retornada pela API; não será incluído no relatório.
3. Uma chave de API **HMAC dedicada** da sua conta Binance real. Para a primeira
   consulta, basta leitura. Deixe desabilitados saques, transferências, margem,
   futuros, opções e outras capacidades adicionais.
4. Para a opção de validar ordem, a API da Binance exige permissão de negociação.
   Nesse caso, o verificador também exige a restrição ao IP do computador que está
   fazendo o teste. O programa não muda permissões nem descobre/inventa esse IP.
   Confirme o IP e as permissões no painel oficial antes de habilitar essa opção.

Digite as chaves apenas nos campos ocultos do programa. Não as envie pelo chat,
não as coloque no comando do Terminal e não as salve em arquivo ou repositório.

## Executar

Baixe o artefato **JENIOS-Binance-R110** na execução aprovada do GitHub Actions,
extraia seu conteúdo e entre na pasta que contém `INICIAR.md`, `lib` e `scripts`.
No Terminal/PowerShell aberto nessa pasta, execute:

```sh
node scripts/platform/connections/r110-binance-real-preflight.mjs
```

Não é necessário `npm install` ou `npm ci` no seu computador.

O programa pedirá a confirmação `CONFERIR`, o UID e uma opção:

- **1 — Consulta:** confere a chave, permissões, conta, quantidade de ativos com
  saldo e número de ordens abertas. Não exibe saldos, UID ou chaves no relatório.
- **2 — Validação sem negociação:** faz as mesmas verificações, consulta os filtros
  do ativo e envia os parâmetros que você escolheu somente para `/order/test`.
  Você informa ativo, lado final, quantidade e preço; o programa não escolhe operações.

O programa solicitará API Key e Secret Key de forma oculta. Ao terminar, encerra o
processo sem gravá-las. Pode interromper com Ctrl+C.

O resultado `nativeOrderTestPassed: true` confirma exclusivamente o teste de
parâmetros feito pela Binance. `realOrdersSent` permanece zero. Você pode compartilhar
o relatório produzido, que não contém as credenciais ou o UID. As informações de
permissões e contagens ainda dizem respeito à sua conta; compartilhe apenas com a
equipe responsável pelo teste.

## Tratamento de pendências

- UID diferente: conferir a conta e a chave no painel; não substituir o UID por
  qualquer número para forçar a associação.
- Chave com permissões adicionais: revisar a chave dedicada no fornecedor.
- Ordens abertas: o modo de consulta funciona; a validação de ordem pede revisão
  humana. O programa não cancela ordens nem fecha posições existentes.
- IP, assinatura ou relógio recusado: corrigir a configuração apontada; não há
  repetição automática de chamadas nem troca de destino.
- Restrição regional/HTTP 451 ou proibição/403: confirmar disponibilidade com a
  Binance. Não usar VPN, proxy ou outro domínio para contornar a restrição.
- Venda em Spot: requer saldo disponível do ativo. Este pacote não habilita margem
  ou futuros para simular uma posição vendida. A direção final do robô deve respeitar
  as capacidades do mercado escolhido.

## O que ainda falta para os robôs negociarem

O verificador não é o conector completo da plataforma. Permanecem necessários:
vínculo autenticado por cliente, cofre e consentimento persistentes, execução do
motor, reserva de risco e diário duráveis, proteções de posições, confirmações,
cancelamento, pausa e reconciliação após falhas. O piloto deve validar esses passos
antes da ativação humana. Testar Binance não homologa outras corretoras.

Para B3, **Profit Pro, Automação de Estratégias e ProfitDLL são produtos/caminhos
distintos**. A Pro permite automação interna em simulação; a automação interna em
conta real depende do módulo aplicável. A ponte externa JENIOS planejada utiliza
ProfitDLL, pacote licenciado e ambiente Windows. Reativar Pro não comprova acesso
à DLL. Verifique com a Nelogica a licença adequada antes de contratar.

## Evidência técnica

R110 possui 28 testes novos. A verificação combinada com R109, leitor Testnet R96
e guias existentes aprovou 113 testes locais. As chamadas autenticadas dos testes
usam dados sintéticos. Nenhuma conta real foi autenticada nesta entrega.

Produção, worker financeiro e permissões das contas permanecem sem alteração.
Não se declara que o restante técnico está concluído ou que há liberação Live.

## Fontes oficiais verificadas em 28/10/2026

- [Binance — consulta de permissões da chave](https://developers.binance.com/docs/wallet/account/api-key-permission)
- [Binance — consulta da conta e ordens](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints)
- [Binance — teste de ordem](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints)
- [Nelogica — acesso à ProfitDLL](https://ajuda.nelogica.com.br/hc/pt-br/articles/51583791325211-Como-obter-acesso-%C3%A0-ProfitDLL)
- [Nelogica — automação interna](https://ajuda.nelogica.com.br/hc/pt-br/articles/8865257831195-Como-utilizar-a-Automa%C3%A7%C3%A3o-de-Estrat%C3%A9gias)
