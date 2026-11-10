# R116 — ambiente próprio do trader

Base: release/jenios-genios-g44-20261024, commit 76b0021c018f05c337a0bb98961c21481ea7bdfa. Incorpora a orientação do proprietário: cada cliente conecta seu robô à própria corretora. Não requer acesso da JENIOS às contas dos traders.

## Entrega

- Interface identifica a titularidade da conexão, exporta somente a configuração guardada/aceita e impede exportação desatualizada após edição.
- Pacote público determinístico com guia, verificador de configuração, diagnóstico Binance Futures somente GET, diagnóstico MT5 da sessão local e inspeção da DLL Profit fornecida pelo trader.
- Leitor local de relatórios: processamento em memória no navegador, sem upload, moedas separadas, ambiente demo/real explícito, operações/paginação/dias/período/acumulado, custos e CSV. Origem importada explicitamente não verificada de forma independente.
- Aritmética decimal inteira em oito casas e exibição sem conversão para ponto flutuante.
- Núcleo de integração offline com diário SQLite, vínculo de conta, exclusão de executores concorrentes, fencing na retomada, intenção persistida antes de envio ao adaptador fictício, pausa após resultado desconhecido e deduplicação dos recibos. Somente `offline_fixture` é aceito; esse núcleo não está no pacote público e não habilita execução real.
- R106 permanece com baseline imutável e extensão R116 individualmente fixada. As extensões antigas e seus hashes não são substituídos.

## Limites factuais

R116 **não conclui a solicitação de negociação autônoma real nos três mercados**. O pacote executa preparação/diagnósticos, não ordens. A implementação anterior também não possuía esses três executores completos. Faltam as pontes nativas de execução e proteção, conciliação de posições/fills/custos e coleta automática dos resultados. Os terminais/SDKs não estão disponíveis neste ambiente para homologação.

Os arquivos locais de resultados devem ser produzidos pelo conector; ainda não há coletor automático entregue. Um arquivo dizer `source: broker` não prova autenticidade, por isso nunca é inserido na tabela de operações confirmadas da plataforma. Importação demo não se mistura com os resultados reais armazenados.

Nenhuma migração, credencial, conta de corretora, transação ou alavancagem foi alterada. Os testes usam fixtures sintéticas; consultas aos fornecedores neste trabalho se limitam à documentação pública. A autorização existente cobre publicação desta interface e deste pacote, não operações financeiras pela equipe.

## Verificação e continuidade

- `node --test tests/platformUltraR116.test.mjs`: cenários novos de diário, recuperação, risco, dados da conta, custos, relatórios e diagnósticos.
- Build geral requerido pelo projeto: `npm run build`.
- Python: compilação sintática; diagnóstico Windows/SDK não executado em equipamento real.
- Tentativa de QA com Chromium local impedida pelo ambiente (`socket: Operation not permitted`); não declarar inspeção visual concluída. A rota temporária de QA foi removida antes do commit.
- O inventário do ZIP compara cada arquivo com o código e com SHA-256; o pacote exclui credenciais, bases locais e núcleo de envio.

Continuidade: implementar e validar separadamente os executores de Binance Futures, MT5 e Profit no ambiente do trader, integrar a reconciliação financeira e só então substituir o estado de preparação por execução disponível. Não inventar valores de liquidez ou recibos; não depender de credenciais dos clientes na JENIOS.
