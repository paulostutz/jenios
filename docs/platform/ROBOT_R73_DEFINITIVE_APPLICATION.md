# R73 — aplicação definitiva dos robôs

## Publicação concluída; conexão operacional depende do host privado

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

A configuração `vercel.json` desabilita apenas deploys Git automáticos das três branches R73 nomeadas. A publicação foi explícita no projeto existente; nenhuma configuração de deploy dos demais trabalhos foi modificada.

O build completo é gate herdado da aplicação. As verificações novas limitam-se à integração, autorização e isolamento; não constituem nova certificação financeira ou repetição do ciclo sintético.

## Dependência externa ainda necessária

Os inventários não identificam um host operacional privado ou volume aceito. O core original foi localizado e comprovado em QA, mas o diretório temporário usado nesse ensaio não é hospedagem permanente. O trabalho existente de fila persistente, retransmissão, pins e worker continua reaproveitável.

O scheduler de evolução não é ligado sem fonte: o tick antigo criaria snapshots vazios e não conectaria o motor. É necessário identificar o servidor/processo que executa o motor e seu volume, instalar a configuração de emissão nele e ligar o hook operacional apropriado. A janela prospectiva exige reação da fonte; um cron isolado não resolve essa conexão.

Monitoramento de clientes permanece inativo. PnL real, perdas reais evitadas e acurácia real continuam `null`. A publicação do aplicativo e sua conexão ao banco estão verificadas. O ciclo operacional completo depende do host privado e da homologação com a identidade real do administrador.

## Fechamento observado

- Aplicativo: https://www.jenios.com.br/platform/admin/robos
- Login dedicado: https://www.jenios.com.br/platform/entrar?dedicated=1&next=/platform/admin/robos
- Código publicado: `ed8b783b6fcb5419afbfb09b274c78fbed05010b`.
- Deployment: `dpl_HWFRPaUD3G5JwgxEDpvPBs6zKRa5`, produção `READY`, preparado em 24/10/2026 às 20:04:58 BRT.
- Domínio verificado em 24/10/2026 às 20:07:50 BRT, respondendo com o mesmo SHA e banco `READY`.
- URL imutável: https://jenios-ecossistem-jmbwvi13g-jenios.vercel.app
- Base G44 e atualização paralela preservadas: `8d4936e0b02c39bb217ad542d01d330dc6cb71d6`.
- Reversão do aplicativo disponível para o deployment anterior `dpl_GXrDuoTaA8rdNJrCVNBadorZgXwz`; não requer apagar ou reverter o esquema do banco.

### Verificações concluídas

Build local da mesma versão: 1.507/1.507 testes gerais, 94/94 verificações herdadas, compilação e 81 páginas estáticas. Os 22 testes pontuais R73 estão incluídos nos gerais. A Vercel executou o guard `production-robots-r73-integrated` e a mesma cadeia de build, concluindo em 45 segundos; o conector retorna uma projeção de 100 eventos, portanto as contagens individuais são atribuídas ao log local, sem inventar totais dos logs remotos.

No deployment: 12 verificações HTTP passaram. No domínio definitivo: quatro verificações passaram, incluindo SHA, banco, autenticação e redirecionamento 308 do domínio sem www. No navegador anônimo: cinco verificações passaram, sem sessão injetada e sem credenciais. A página não expôs feed e o link abriu o formulário dedicado da Platform.

A primeira tentativa do Chromium não confiava na CA do ambiente; a segunda exigiu configuração explícita do proxy. A terceira passou nos cinco checks, mas falhou ao encerrar uma requisição de prefetch. O harness final aguardou as requisições antes de encerrar e terminou com exit 0. A renderização utilizou relay do cliente Node com TLS verificado, CA e proxy já configurados, limitado ao deployment exato; não se utilizou `ignoreHTTPSErrors`, certificado ignorado, resposta fictícia ou autenticação simulada. Isso verifica o percurso anônimo, não o login humano administrativo.

A sonda hospedada confirmou as 16 tabelas e os controles de geração/preços desativados, sem criar registros. A conferência SQL posterior manteve zero observações/ciclos/capturas/revisões e os controles fechados. A sonda tem token servidor exclusivo e expira automaticamente às 21:03:24 BRT de 24/10/2026. Nenhum token está nos arquivos de evidência.

### Pendência operacional precisa

Ainda não foi identificado o servidor permanente no qual o motor privado deve executar, com volume persistente e custódia das chaves. A busca final encontrou somente um workspace Render acessível e seis projetos Vercel JENIOS; nenhum identificou esse host/volume. Isso não prova que o host inexiste em outro provedor. O inventário não autoriza substituir outro produto por um host dos robôs.

Para conectar o emissor persistente existente, é necessário fornecer o provedor/nome/ID/endereço do servidor do motor, ou definir sua hospedagem. Nenhuma senha deve ser colocada no chat ou no Git. Após esse vínculo, o hook de dados operacionais e o worker poderão ser instalados e verificados no recurso real; não é necessário reconstruir os robôs ou repetir a certificação sintética.

O commit de consolidação documental e o backup final registram este resultado sem mudar o código publicado. As 22 seções/campos anteriores do ledger foram preservados; `definitiveApplicationPublication` é a 23ª entrada. A publicação não altera as atribuições históricas dos JSONs R65/R71/R72.
