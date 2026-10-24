# R73 — aplicação definitiva dos robôs

## Preparação para publicação autorizada

Este bloco integra a administração dos robôs na aplicação definitiva. O proprietário pediu a publicação no banco final, a passagem ao definitivo e a conclusão do trabalho restante. A publicação do aplicativo segue essa autorização. A autorização não habilita ordens reais, Paper externo, chamadas pagas dos robôs ou aprendizagem arbitrária.

O banco R72 já foi instalado: nenhuma migração é reaplicada neste bloco. A base dos robôs continua sendo o R71 certificado. Foram reaproveitados 77 arquivos sem alterar seus bytes ou reatribuir suas evidências. O motor privado permanece fora do repositório público.

## Preservação da aplicação publicada

Base final: `8d4936e0b02c39bb217ad542d01d330dc6cb71d6`, deployment `dpl_GXrDuoTaA8rdNJrCVNBadorZgXwz`, domínio `www.jenios.com.br`. A primeira base examinada foi `81a0cd8f3ce1205f4d5db456388a4fe32964b4b8`; uma publicação paralela alterou 12 arquivos, todos preservados integralmente antes da publicação R73. Nenhum merge foi realizado. Nenhum arquivo de pagamentos, Social, assistentes, CHEFE ou LETTER foi modificado pelos robôs.

As únicas extensões a arquivos existentes são o link administrativo, a opção explícita `dedicated=1` no login e o reconhecimento da branch R73 no guard de publicação. Os controles G44 e S05 permanecem obrigatórios. Pacotes e lockfile são preservados.

## Comportamento entregue

- `/platform/admin/robos`: shell sem feed administrativo no HTML anônimo.
- `/api/platform/admin/robots/status`: GET somente leitura, validando o bearer com Auth dedicado da Platform e a permissão `platform.admin`.
- Consulta real das 16 tabelas instaladas por contagens HEAD e leitura de dois campos de configuração. Nenhum conteúdo de observação, código privado, cliente ou credencial entra na resposta.
- Fonte configurada não significa motor conectado. Ausência de dado ou erro aparece como pendência/null; não produz zero ou sucesso fictício.
- Token administrativo da Social não é aceito pelo novo endpoint. O login `dedicated=1` evita o redirecionamento pela sessão Social; o comportamento normal G44 permanece intacto.
- O feed é descartado ao sair ou trocar de conta. Não há comandos de evolução, ordens ou provedor nessa superfície.

Os componentes QA R65/R67/R70/R71 foram transportados com gates originais fechados em produção. Não se altera `VERCEL_ENV`, não se abre R61 e não se promove o domínio de evidência sintético a operacional.

## Verificação da implantação

A sonda `/api/platform/internal/robots/deployment-status` aceita somente GET, token exclusivo e janela de uma hora. É limitada à conectividade, configuração e disponibilidade das estruturas, sem feed, registros, mutações ou autorização administrativa. Seu token não autentica o painel. A sonda expira no próprio runtime; não comprova login humano.

A configuração `vercel.json` desabilita apenas deploys Git automáticos das três branches R73 nomeadas. A publicação será explícita no projeto existente; nenhuma configuração de deploy dos demais trabalhos é modificada.

O build completo é gate herdado da aplicação. As verificações novas limitam-se à integração, autorização e isolamento; não constituem nova certificação financeira ou repetição do ciclo sintético.

## Dependência externa ainda necessária

Os inventários não identificam um host operacional privado ou volume aceito. O core original foi localizado e comprovado em QA, mas o diretório temporário usado nesse ensaio não é hospedagem permanente. O trabalho existente de fila persistente, retransmissão, pins e worker continua reaproveitável.

O scheduler de evolução não é ligado sem fonte: o tick antigo criaria snapshots vazios e não conectaria o motor. É necessário identificar o servidor/processo que executa o motor e seu volume, instalar a configuração de emissão nele e ligar o hook operacional apropriado. A janela prospectiva exige reação da fonte; um cron isolado não resolve essa conexão.

Monitoramento de clientes permanece inativo. PnL real, perdas reais evitadas e acurácia real continuam `null`. A conclusão hospedada e os links de publicação serão acrescentados após verificação do deployment.
