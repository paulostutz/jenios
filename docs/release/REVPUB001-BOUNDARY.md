# REVPUB001 — publicação Web com integração financeira desativada

## Escopo aprovado

A autorização de 13/11/2026 permite publicar somente partes concluídas e validadas. Base Web: `d71bf6cdc237c7fa1ba082242fa6f09f1cbf895a`, árvore `db07e4e6b22d73af7e71db6dccf27de81a9af2a5`. Runtime preservado, sem instalação: `22421826952434087e274e74aa855d97f57b037b`, árvore `89e9ce5936fbbe671e498af667bdb8aa3198cab5`. O núcleo privado R114 não integra este repositório ou o pacote de publicação.

O plano avulso permanece R$ 19,90 por mês ou R$ 199,00 em pagamento único por 12 meses. O período começa após confirmação do pagamento. A participação é 20% no plano de entrada; 10% depende de elegibilidade aprovada e comprovada para produto e versão. A publicação não concede direitos, não inclui o Reverso em outro plano e não altera direitos históricos.

## Fronteira publicada

As três rotas Reverso compõem `publication-boundary-v1.mjs`. Em implantações Vercel, as fontes de estado financeiro e contratação retornam indisponível sem instanciar ou chamar o transporte do runtime, mesmo com flags antigos habilitados. Os handlers preservam autenticação exclusiva da Platform, controle administrativo existente, reconferência de identidade/permissão, mesma origem e respostas privadas sem cache.

Valores ausentes continuam indisponíveis e as capacidades reais continuam falsas. A contratação retorna indisponível; isso não equivale a pedido emitido, pagamento recebido ou acesso concedido. A interface explica o bloqueio e mantém preços para consulta. Os adaptadores demonstrativos originais continuam disponíveis nos laboratórios locais, com dados fictícios e validação de modo demonstrativo.

O gate de produção recusa `REVERSO_RUNTIME_READ_ENABLED`, `REVERSO_SUBSCRIPTION_DEMO_ENABLED` e `JENIOS_REVERSO_PLAN_ISOLATION_V1` se não estiverem ausentes, vazios ou `false`. O código não altera valores remotos. As configurações gerais de cobrança Letter são preservadas e não autorizam o Reverso.

## Dependências para ativação financeira

A consulta limitada aos registros autorizados não encontrou catálogo Reverso ou vínculos G47 no ambiente Social consultado. A configuração de pagamentos da Platform permanece desativada. O runtime privado observado contém observações de mercado/simulações, sem execuções próprias reconciliadas de clientes ou custos realizados atribuídos ao Reverso. Sinais não podem ser convertidos em lucro do cliente.

Faltam fonte reconciliada de execuções/custos; vínculo comprovado entre titular Platform, pagador Social, conta, corretora, ambiente, moeda e robô; autorização atual; montagem persistente dos adaptadores; homologação de recibos e direitos reais/legados aplicáveis. Não se copiam usuários entre projetos, presumem vínculos por e-mail ou instalam carteiras paralelas.

A especificação Ultra v4 apura por operação positiva e não autoriza agregação mensal para o Reverso. Os exemplos mensais REVFIN002 são testes sintéticos. É necessária decisão específica sobre unidade/período, perdas e compensações dentro/entre meses e contas, custos e rateio, moeda/conversão, arredondamento, elegibilidade dos 10%, termos, revisões e estornos. A política do Ultra e eventual tarifa de ciclo não são transferidas.

## Cadeia de código

A sucessora executa o verificador d71 original com bytes e inventário predecessores exatos, depois confere substituições e adições explícitas. A aprovação Web mantém falsas as capacidades financeiras históricas. O gate exige identidade GitHub, branch própria, projeto Vercel, commit real e árvore limpa.

O transporte Git conectado cria um novo commit real com pai na publicação `0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47`, mas não reproduz os metadados antigos. `REVFIN002-WEB-PREDECESSORS.pack` conserva os objetos de prova originais sem reescrever commits, refs, remotes ou arquivos: 196 objetos, 180527 bytes, SHA-256 `19c32ec2c1b3bd1c0840e0d30928ced8882cab2e2849460b7423d7a1572d5f24`, adicionais ao snapshot 0ed, pré-requisito explícito.

O bootstrap verifica tamanho/hash antes de usar Git; importa somente esse pack local por `git index-pack --stdin` quando necessário e confere todas as árvores esperadas. Não busca objetos na rede. O teste parte de checkout raso 0ed, restaura objetos e executa o verificador REVFIN002 original. Ausência do pré-requisito ou corrupção bloqueia o build.

## Evidências

Os testes novos cobrem fronteira hospedada, flags latentes, repetição/concorrência sem transporte, autorização alterada, estados indisponíveis, laboratório preservado e restauração rasa. Testes financeiros anteriores permanecem vinculados aos hashes originais; não são apresentados como reexecução atual. O build completo Web é necessário porque o código hospedado e a montagem mudaram.

Fixtures estáticas renderizadas em navegador, em frames 320/390/1440 px, são evidência sintética. Não comprovam sessão real, persistência produtiva, recibos ou integração financeira. Homologação real exige sessões autorizadas de cliente/Admin; sua ausência deve constar do checkpoint. O checkpoint externo registra testes efetivamente executados, commit/deployment, links e recuperação. Este documento delimita o escopo e não comprova publicação por si só.
