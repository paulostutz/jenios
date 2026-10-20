# JENIOS B187–B189 — aceitação de segurança e ensaio real do ledger

Data: 20/10/2026. Branch privada de desenvolvimento: fix/jenios-b187-b188-real-ledger-gates-20261020.

## Escopo concreto

- B187: corrige a lógica de integridade da CI do B186. O checker original B184 não foi modificado nem relaxado. Novo checker exige exatamente 13 arquivos adicionados entre B177-R3 e B184-R2, exige preservação bit-a-bit dos arquivos protegidos B177, exige preservação bit-a-bit dos 13 arquivos B184 e limita a adição cumulativa dos B185–B189 aos caminhos declarados.
- B188: reproduz todos os seis resultados B185 sobre a implementação SQLite B152, não um ledger simplificado em memória. São exercitados os três modos direct, reverse, hybrid por meio do adaptador existente Alpaca Paper de proposta e reserva.
- B189: verifica teto de risco compartilhado, timeout e reinício, rejeição de reenvio, resolução de estado desconhecido apenas por evento explícito, cancelamento parcial e retenção de risco, liberação por CLOSED, pausa de entradas e verificação mock de duas pernas bracket sem reivindicar garantia do stop.

## Distinções de prova

Os testes conectam contratos de autorização, criação de proposta e risco aos cenários sintéticos, mas não invocam o código proprietário do robô para produzir decisões. Nenhuma corretora autenticada foi acessada, nenhum worker persistente foi implantado e nenhuma ordem real ou Paper foi transmitida. As três modalidades compartilham o mesmo motor de risco e a mesma sequência sintética, sem que isso prove qualidade da estratégia ou lucro.

O B182 historicamente avaliou hipóteses com holdout e evidências majoritariamente negativas. Portanto, este bloco NÃO certifica desempenho, expectativa positiva, robustez fora da amostra ou prospectividade. A pesquisa retrospectiva e a janela prospectiva autenticada precisam de evidências independentes antes de prometer resultados.

## Gates de ativação para a corretora do cliente

1. Vínculo individual via API/terminal oficial com autenticação, identidade de conta, permissões limitadas, revogação e auditoria de tokens em cofre.
2. Reserva SQLite durável, limitadores de perda/capital, idempotência e auditoria de reconciliação antes de qualquer integração Paper operacional.
3. Worker privado isolado com alarmes, segredos por canal seguro, aprovação separada para piloto Paper e consulta independente do broker.
4. Stop e alvo verificados como presentes no broker, sem promessa de preço garantido; controles de falha de rede, slippage e contingência operacional.
5. Estudos prospectivos com dados testemunhados e amostras fora da amostra com custos completos e resultados negativos incluídos; revisão humana independente.
6. Dinheiro real permanece NO_GO até autorização própria específica, homologação externa e conformidade aplicável.

O provedor Alpaca permanece Paper-only no código; Binance Spot Testnet permanece somente consulta demonstrativa. Os demais conectores são guias ou integrações que dependem de permissões/licenças específicas. JENIOS não detém custódia ou pagamentos da conta do cliente.

## CI

A execução de GitHub Actions deste branch é a fonte autoritativa do resultado de CI. Nenhum commit deve ser declarado certificado até status SUCCESS, testes e artefatos conferidos. Não publicar produção com falha ou pendência de integração.
