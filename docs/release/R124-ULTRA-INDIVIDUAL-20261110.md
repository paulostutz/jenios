# R124 — Ultra individual: conciliação e publicação compatível

Base publicada JENIOS: `25770702de5acfa2eb5e7e6d44a62386eba37a93` (R117).
R120 e R123 foram comparadas e preservadas como candidatas, não incorporadas
integralmente ao release. R123 `7c25bb20522fe5172e70bf670eca01d097b9fb68`
continua laboratório de cobrança. Flow parte de COPY003/CONCIL001 em cópia isolada.

## Implementação nova

- Área individual de consulta sem gráficos aceita o formato real exportado pelo
  CLI R117: `JENIOS_ULTRA_OPERATIONS_V1`, inclusive `accountFingerprint` opcional.
  A tela anterior aceitava somente o relatório legado de encerramentos.
- Operações preparadas, enviadas/incertas, abertas, parciais, recusadas,
  canceladas e encerradas aparecem sem virar lucro definitivo por suposição.
- Arquivo único por conexão e ambiente, com moedas separadas, ganhos/perdas,
  custos/rebates/funding e resultado por operação, período e acumulado do arquivo.
- Só encerramentos com custos completos entram nos totais. Assinatura, abertura
  e performance permanecem separados; resultado final desses custos é pendente.
- Na JENIOS, filtro de conexão faz leitura autenticada do proprietário e da
  conexão selecionada. Resposta truncada/sem contagem exata recusa consolidação;
  não há mudança de schema ou grants. Limite de 5.000 registros nessa consulta,
  sujeito ao limite Data API; acima/na truncagem usa-se relatório local.
- Troca de usuário limpa o painel e reinicia consultas; importação exige sessão
  atual. Nada é salvo no navegador nem enviado à plataforma pelo leitor de arquivos.
- Flow reutiliza os validadores R117, o mesmo leitor e prepara configuração pelo
  contrato local R116, sem credenciais ou autorização de execução. `/ultra` usa
  ownAdmission e a sessão existentes; importação revalida o workspace no servidor.
- Valores e inclusão preparados: Ultra R$19,90/mês ou R$199 num pagamento por
  12 meses desde confirmação Letter; nos demais planos JENIOS, incluído; Flow
  Pessoal DeFi separado, demais incluído para titular; profissional não concede
  Ultra aos clientes. Nenhum desses metadados cria direito pago.
- Proposta de taxa de R$5 em start retorna chave determinística no namespace
  central de conta/operação, comum a ambas as plataformas; nunca debita. A fonte
  desse vínculo ainda deve ser autoritativa. Não é reserva/ledger de cobrança.

## Regras e conflitos preservados

O pedido recebido mantém a performance por operação e o tratamento de perdas
em confirmação. Nenhum cálculo/faturamento de performance foi alterado ou
ativado. CP014/COPY003 e registros anteriores são evidência histórica; a nova
área marca a divergência e a cobrança desligada. Antes de ativar, resolver a
periodicidade, compensação de perdas e percentuais aplicáveis por contrato.

Start foi informado como gatilho dos R$5. Ainda faltam as condições para
parciais, recusa, cancelamento, saldo insuficiente e estorno. Campos de política
ficam nulos e o débito bloqueado; não foi presumido reembolso nem autorização
de saldo negativo. Repetir a preparação não executa cobrança.

Assinaturas anuais x10/12 e confirmação imutável estão preparadas em R123,
CB014–CB016 e CONCIL001. A CB016 já valida a ponte SQL da central em laboratório;
não refazemos essa prova nem declaramos a ponte SQL pendente. Falta a integração
produtiva transacional do repositório nativo, reserva de emissão e grant,
identidade/chaves reais, contratos/aceite e homologação. A renovação antecipada
`max(confirmação,fim anterior)` segue proposta, sem ativação. V1/mensais e períodos
pagos não foram migrados, recalculados ou duplicados nesta entrega.

## Ciclo de operação e fronteira real

R118–R120 já possuem diário de intenção, protocolos Spot/Futures de laboratório,
parciais, recusa/cancelamento, pausa, lookup de resposta incerta e reconciliação
após reinício. Seus registros foram lidos, sem repetição das baterias históricas.
Não são transporte real ou homologação numa conta de corretora. A nova prova
R124 apenas verifica diário persistente R117 → reinício → exportação → painel.

Faltam no ambiente do trader: autenticação/decodificação nativa, sessão/stream,
sincronização de relógio, permissões e elegibilidade de produto/país/conta,
reserva de margem/risco, supervisão de proteção, reconciliação de conta/fills e
custos, e ensaio autorizado em demonstração. Não foram fornecidas credenciais
nem enviadas ordens; ninguém precisa fornecer acesso às corretoras à plataforma.
Pausa/desconexão nunca confirma posição encerrada. Alavancagem escolhida não é
reduzida silenciosamente: orientação exige ciência, mas limites/margem do broker
e elegibilidade continuam obrigatórios. Não se contornam restrições.

Profit exige ProfitDLL.zip oficial contratado/licenciado, DLL/arquitetura,
declarações/tipos e manual da mesma versão, Windows compatível e roteamento
autorizado para a conta e mini índice. Não foi encontrado esse pacote nos
artefatos recebidos e não foi inventada ABI. Referências oficiais:

- https://ajuda.nelogica.com.br/hc/pt-br/articles/51583791325211-Como-obter-acesso-%C3%A0-ProfitDLL
- https://ajuda.nelogica.com.br/hc/pt-br/articles/11166353435035-Introdu%C3%A7%C3%A3o-ao-Produto-DLL-Real-Time
- https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade
- https://github.com/binance/binance-spot-api-docs

## Verificação e limites

JENIOS: 14 testes dirigidos novos; Flow: nove dos testes do mesmo modelo executados
na cópia real da plataforma. São contagens por produto, com nove definições
equivalentes; não se declaram 23 cenários independentes. Testes com sessão/banco
fictícios e SQLite local. Sem autenticação real de usuário ou corretora.

Build JENIOS via `next build` (inclui lint/tipos); Flow via helper oficial e
TypeScript. Não foi executado npm build JENIOS, pois repetiria toda a bateria
histórica automaticamente. Alterações finais justificaram repetição dirigida
dos novos testes/builds; contagem de definições não foi multiplicada.

Sem validação visual autenticada: não havia sessão de teste autorizada pronta.
Não se tentou a prévia anteriormente recusada, browser/DOM, túnel ou porta
alternativa. Verificação de build/fonte não substitui revisão visual ou homologação.

Publicar somente leitura/configuração/copy compatíveis, preservando marca,
público e acessos existentes. Nenhuma migration, novo grant, segredo, cobrança,
concessão de assinatura ou operação financeira foi ativada. Evidências e estado
efetivo do deploy ficam no checkpoint de entrega, não presumidos neste documento.
