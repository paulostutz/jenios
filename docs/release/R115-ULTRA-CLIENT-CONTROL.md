# R115 — Ultra: capital, alavancagem e resultados

Solicitação de Paulo: seleção automática para B3/cripto/Forex, capital definido pelo cliente, aviso de alavancagem alta com opção de continuar e relatórios por operação/período/geral. Publicação autorizada. Base: a17ff75b927e7c1671d81ec77e8de76546799ad8, preservando CB006 e R114.

## Entrega
- Nova área autenticada `/platform/ultra`, acessível na Sala de Controle e administração dos robôs.
- Orçamentos e moedas separados por mercado; teto de alavancagem, duração, número de posições, risco por operação, pausa diária, concentração e exclusão de ativos.
- Alavancagem elevada gera orientação concreta e aceite explícito, não veto por perfil. Configuração e aceite correspondente ficam em registro imutável no banco exclusivo da Platform. Alterações exigem nova revisão. O cliente pode escolher acima de 10x no planejamento; o teto real depende do instrumento/corretora. R18 histórico é preservado byte a byte.
- Reaproveitamento do ranking R53 em observações normalizadas dos três mercados, com Forex explícito. Dimensionamento por risco, lote, contrato, conversão cambial, exposição e margem. Não presume livro para Forex.
- Contrato de revisão por ordem: aceite específico, vínculo de conta, expiração e distinção entre orientação e impedimentos técnicos. Exige reserva durável, consumo único e preflight atual no futuro executor.
- Relatório em banco de operações encerradas: ganhos líquidos, perdas líquidas, bruto, taxas, financiamento e lucro/prejuízo líquido por moeda; filtro de período, acumulado, detalhamento diário e paginação por operação. Agregados incluem todas as linhas, não somente a página. Funding recebido é custo negativo. Posições abertas não são tratadas como lucro realizado.
- Autenticação Platform no servidor, sem fallback de JWT Social. Tabelas com RLS e acesso direto revogado para anon/authenticated. Função de relatório security invoker, somente service_role, sempre com identidade derivada da sessão validada.

## Limites da publicação
Esta entrega publica configuração, orientação e relatórios, além de módulos de preparação da seleção/dimensionamento. Não conecta um executor financeiro nem cria uma rotina em background.
ProfitDLL: R109 ainda precisa do pacote/licença e ponte Windows. Binance Futures: R110 é preflight Spot; falta transporte Futures homologado. MT5: falta ponte operacional autenticada. As telas mantêm esses estados como pendentes. Nenhuma ordem real ou paper externa é enviada; nenhum segredo de corretora é recebido.
O coletor que alimentará `jenios_ultra_trades` ainda depende dessas integrações e deve usar recibos reais, idempotência por conta/ID de trade e cálculo validado de custos. Não há importação manual de lucro, operações inventadas ou classificação de dados sintéticos como financeiros. A tabela vazia é apresentada como ausência de operações confirmadas.
Aviso aceito não altera margem, limite da corretora, permissões, mercado fechado, dados vencidos ou conexão inconsistente. A estratégia existente e seus resultados de pesquisa não foram convertidos em autorização Live. Métricas de desempenho não são prometidas.

## Validação e continuidade
Testes direcionados R115: risco advisory, aceite/alteração, isolamento de identidade, filtros dos três mercados, dimensionamento, período e bloqueios técnicos. Verificação SQL transacional dos relatórios e privilégios. Build completo e regressões exigidos pela release. Manifesto de extensão mantém hashes dos predecessores e aceita apenas as alterações declaradas.
Antes de execução financeira, concluir os três conectores e o worker durável; integrar consumo único do aceite por ordem, reserva, confirmação de fills, cancelamento, proteção de posições, pausa/encerramento e recuperação pós-desconexão. A autorização para publicar o produto não equivale a movimentar contas de clientes.
