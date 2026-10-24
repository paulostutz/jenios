# R72 — instalação no banco definitivo da JENIOS Platform

## Resultado

**Migração aplicada e verificada no banco definitivo da Platform em 24/10/2026, às 22:33:35 UTC (19:33:35 de Brasília).** O pacote R64 → R65 → R67 → R71 está instalado. A verificação foi feita no PostgreSQL hospedado real; nenhuma nova bateria sintética foi executada.

| Item | Identificação |
|---|---|
| Projeto Supabase | `jenios-platform-homologacao` |
| Ref definitivo Platform | `xaicvhagftzjkqphnbgx` |
| Região / PostgreSQL observado | `sa-east-1` / `17.11` |
| Migração registrada | `20261024223334_jenios_robot_r72_definitive_store` |
| Resultado do provedor | `success:true`, uma aplicação |
| SQL aplicado — SHA-256 | `84408ccac4cd794016069301d97b4149e0afc7becfba6367e00eb40f1fcb75ed` |
| Branch de registro | `research/jenios-robot-r72-definitive-database-20261024` |
| Backup | `backup/jenios-robot-r72-definitive-database-installed-20261024` |

O nome histórico do projeto contém “homologacao”, mas a guarda de build da versão G44 atual exige esse mesmo projeto dedicado da Platform em produção. O control plane Vercel retornou o deployment READY `dpl_2V4cExgpq2cCuPfyGf4Shc6NgNeV`, SHA `81a0cd8f3ce1205f4d5db456388a4fe32964b4b8`, branch `release/jenios-genios-g44-20261024`; o código desse SHA fixa a URL `https://xaicvhagftzjkqphnbgx.supabase.co`. Não foi criado outro banco nem consultado o valor de credenciais privadas.

## Autorização e retomada

Antes das alterações, foram consultados o backup e o checkpoint pós-R71 no SHA `766fa78746f3dcd096063ad90dca292edaea82b5`, o ledger e a base de código certificada R71 `3fb6e9c4335422440d149fd969907e9eddc840c6` (CI `40135970938`).

O proprietário alterou expressamente o limite anterior de migrações hospedadas com as instruções “Publique já no banco final” e “Vamos logo para o definitivo”. Esta instalação usa essa autorização. Os registros históricos que afirmam zero migrações continuam corretos para seus respectivos fechamentos; não foram reescritos.

O banco definitivo foi alterado. A publicação do site, o código G44, Auth, configuração de produção da aplicação, scheduler, host privado, clientes, ordens e provedores pagos não foram alterados ou ativados por esta migração.

## Componentes instalados

| Bloco | Tabelas | Funções/helpers | Finalidade |
|---|---:|---:|---|
| R64 | 4 | 8 | Observações, ciclos, configuração e reserva de orçamento |
| R65 | 6 | 15 | Proveniência, evolução, validação, arquivo lógico e reconciliação |
| R67 | 1 | 2 | Capturas privadas assinadas |
| R71 | 5 | 14 | Observações contextuais, estudos congelados, casos e histórico da política privada |
| Total | 16 | 39 | Estrutura durável dos dois ciclos já implementados |

Também estão presentes os oito índices explícitos dos arquivos certificados e os três triggers R65. Os índices implícitos de chaves primárias e unicidade não são somados a esse número.

A instalação escreveu somente uma linha de configuração inicial R64: geração e aprovação de preços desativadas, lista de modelos vazia e limites de custo iguais a zero. As outras 15 tabelas ficaram vazias. Não foram fabricadas observações, estudos, casos de validação ou métricas operacionais.

## Como a aplicação preservou o banco existente

A consulta prévia de catálogo não encontrou objetos R64/R65/R67/R71 no projeto. Foram registradas assinaturas das seis relações e três funções preexistentes no esquema `public`, incluindo metadados de colunas, restrições, índices, triggers, políticas e grants, sem consultar linhas de clientes.

O pacote foi aplicado como uma única instrução `DO` atômica. O wrapper recusa colisões e não captura exceções para continuar parcialmente. Um advisory lock não bloqueante coordena chamadas da instalação; os comandos `CREATE` estritos também recusam objetos criados concorrentemente por outro participante.

Os quatro arquivos SQL certificados permanecem inalterados no repositório. A composição adaptou somente a forma de instalação:

- Removeu os `BEGIN/COMMIT` externos de cada arquivo para evitar commits intermediários.
- Trocou os cabeçalhos `CREATE OR REPLACE FUNCTION` por `CREATE FUNCTION`.
- Retirou `IF NOT EXISTS` dos cabeçalhos de tabelas e índices para recusar colisões.
- Retirou três `DROP TRIGGER IF EXISTS` que seriam operações sem efeito em tabelas novas.
- Preservou os 39 corpos de função, definições, restrições, grants e comportamento dos triggers.

Antes de concluir a instrução, o próprio banco conferiu contagens, RLS, hashes das funções, ausência de privilégios públicos, privilégios do servidor e configuração inicial desativada. Um erro nessas condições abortaria todo o pacote. Não houve exclusão de tabela, função ou registro existente.

A CLI oficial `2.122.0` criou o arquivo de migração. Depois da aplicação pelo conector, o nome local foi reconciliado com a versão efetivamente registrada no histórico Supabase, `20261024223334`; o SQL permaneceu idêntico.

## Verificação realizada no banco definitivo

| Verificação real | Resultado |
|---|---|
| Tabelas presentes e com RLS | 16/16 |
| Corpos das funções iguais aos certificados | 39/39 |
| Funções `SECURITY INVOKER` com `search_path` vazio | 39/39 |
| Índices explícitos presentes e válidos | 8/8 |
| Triggers R65 presentes | 3/3 |
| Acesso efetivo de `anon`/`authenticated` a tabelas, colunas e funções | Nenhum |
| Acesso de leitura/execução esperado para `service_role` | Presente |
| `DELETE` e `TRUNCATE` do `service_role` nas 16 tabelas | Nenhum |
| Atualização das seis tabelas privadas R67/R71 pelo `service_role` | Nenhuma |
| Atualização limitada R65 | Cinco colunas do arquivo e `generation_enabled` da configuração |
| Configuração inicial / orçamento | Uma linha desativada / zero linhas de orçamento |
| Observações, ciclos, estudos e evolução inseridos | Zero |
| Histórico de migração | Registro presente, versão `20261024223334` |
| Seis relações e três funções anteriores | Assinaturas idênticas antes/depois |

Assinaturas de preservação:

- Relações: `55ebc310f6ce9670f9074c1466f5e7533ba9cfa249dea50a1ecaab7594466443`.
- Funções anteriores: `3dd4e9fa64542e3a855d24f6ee69ed4c1b4396de051a2f096453286e4eb67271`.

Essas são verificações de instalação e metadados reais. Não são operações de mercado, testes de rentabilidade ou nova contagem de desempenho dos robôs.

O advisor retornou avisos informativos de RLS sem políticas nas tabelas dos robôs. Isso corresponde ao desenho fechado: `anon` e `authenticated` não têm acesso; o servidor usa `service_role`, que é confiável e contorna RLS. Não foram criadas políticas abertas para silenciar o aviso. O advisor também registrou a configuração de proteção contra senhas vazadas do Auth como desativada; essa configuração global foi registrada, sem alteração neste trabalho de banco dos robôs.

## O que significa verificação controlada no banco definitivo

O banco instalado é o definitivo. Uma verificação operacional posterior poderá usar um escopo/fonte reservados para QA dentro das estruturas já instaladas, com identidade administrativa real e registros identificados. Isso não exige, por padrão, criar outro banco nem repetir as baterias sintéticas concluídas.

O isolamento por `scopeId`/`sourceId` é lógico e depende do servidor e dos RPCs; a chave `service_role` não é limitada a um único escopo. As tabelas R64 de configuração e orçamento são globais, portanto um aceite privado não deve alterar orçamento, financiamento ou reconciliação de custos. Os harnesses projetados para PostgreSQL descartável não devem ser apontados para este banco definitivo.

## Pendência real de publicação da aplicação

A árvore completa do SHA de produção `81a0cd8f3ce1205f4d5db456388a4fe32964b4b8` foi consultada sem truncamento. Ela ainda não contém os endpoints R65/R67/R70/R71, a página `/platform/homologacao/robos/privado` nem o worker R71. Essa é evidência de ausência no código publicado; não foi alegado um status HTTP 404 observado.

Portanto, a instalação do banco está concluída, mas o ciclo não está ativo no aplicativo publicado. A entrega seguinte exige integrar/publicar os componentes já certificados sobre a versão atual G44, preservando o trabalho paralelo, e vincular o host privado/fonte e scheduler reais. Publicar a branch antiga de pesquisa inteira sobre G44 sobrescreveria avanços alheios e não é o procedimento indicado.

O contrato certificado R71 continua sendo de entradas sintéticas e política limitada em QA. A integração com decisões operacionais precisa preservar sua proveniência e não pode reclassificar fixtures como operações de clientes. Nenhum código do motor privado foi reconstruído, publicado ou alterado neste bloco.

## Registros e fechamento

- Migração: `supabase/migrations/20261024223334_jenios_robot_r72_definitive_store.sql`.
- Evidência: `docs/platform/evidence/ROBOT_R72_DATABASE_INSTALLATION_EVIDENCE.json`.
- Checkpoint: `docs/platform/evidence/ROBOT_R72_DATABASE_INSTALLATION_CHECKPOINT.json`.
- Auditoria: `docs/platform/evidence/ROBOT_R72_DATABASE_CHANGE_AUDIT.json`.
- Ledger: nova seção `definitiveDatabaseInstallation`, preservando os 21 campos/seções anteriores.

Este fechamento usa o resultado da aplicação e as consultas reais do banco, além da revisão do arquivo SQL. Não houve novo build, CI de certificação ou bateria sintética. O backup é identificado como instalação verificada do banco, não como certificação operacional completa.

Após salvar, conferir pesquisa e backup no mesmo SHA, checkout limpo, R71 preservado e nenhum deployment do SHA de registro. Não gerar commit recursivo apenas para inserir seu próprio SHA. A migração hospedada não deve ser reaplicada: o nome/versão já existem e o wrapper recusa objetos presentes.

Ordens reais, Paper externo e chamadas pagas a provedores neste bloco: zero. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` continuam `null`. Monitoramento de clientes e runtime operacional novo permanecem inativos.
