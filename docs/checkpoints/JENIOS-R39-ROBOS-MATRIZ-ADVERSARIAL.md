# JENIOS R39 — Validação adversarial dos robôs (checkpoint privado)

Data: 16/10/2026. Escopo: exclusivamente JENIOS Platform. Este branch guarda apenas documentação, não o núcleo proprietário.

## Estado protegido
- Produção main: 8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10 (R35), sem alterações nesta etapa.
- 501 arquivos da aplicação e o motor original de sinais idênticos byte a byte aos arquivos R38; nenhum arquivo anterior removido.
- Único módulo preexistente modificado: nucleo-privado/validation-r38.mjs, para janela curta de replay intradiário equivalente.

## Testes e resultados executados
- 334 testes do núcleo privado aprovados; 674 da aplicação aprovados; 355 arquivos verificados na sintaxe; build Next 16/Webpack aprovado.
- 38 cenários de preços INTEIRAMENTE SINTÉTICOS, com 414.720 candles artificiais; 2.655 oportunidades teóricas e 1.047 em holdout artificial.
- 200.000 verificações de limites de risco: zero excessos de orçamento/nocional ou números não finitos detectados.
- Inversão ingênua melhor que sinal em 6/38 cenários; sinal superior em 32/38; 36/38 séries com menos de 50 observações individuais no holdout.
- Testada a função real chooseMode do núcleo R38 nos modos manual, híbrido, reverso sem calibração e reverso com calibração apenas simulada; sem demonstração de rentabilidade.
- Política de pesquisa walk-forward distinta do robô definitivo: 1.338 decisões diretas, 4 inversões, 1.313 abstinências; resultados melhores que benchmark direto em 14/38 carteiras artificiais, iguais ou piores em 24/38.
- Há testes contra antecipação do futuro, regressão da contabilidade de loss hipoteticamente evitado, custo excessivo, gaps e procedência adulterável. Resultados desfavoráveis NÃO foram removidos.

## Limites da evidência
Qualidade técnica da bateria: PASS. Vantagem financeira real: NÃO COMPROVADA. Loss real evitado de clientes: NÃO MEDIDO. Ordens reais: NO_GO.
Não foi possível importar preços históricos oficiais comprovados; checksum sozinho garante igualdade de bytes, não autenticidade de preços. Necessários histórico real, custos, holdout com política congelada, intenções de clientes com timestamp externo, corretora demo e auditoria independente.

## Backup privado permanente
- Biblioteca: /JENIOS-Platform-R39-completo-privado.zip.
- ZIP: 10.952.740 bytes; 803 entradas, 802 arquivos com SHA256 verificado.
- SHA256: fa01ef26509419899569aca5aeb4d881b866ae80df5eb6c13a672d70f795de97.
- Inclui app cumulativa, núcleo privado separado, relatório PDF de quatro páginas, matrizes, logs e testes. Não publicar este ZIP nem o núcleo em GitHub público.
- A produção R35 e as APIs da Social, BankScore, Validador, PDFs e PAY foram preservadas.

CONCLUSÃO: robôs ainda NÃO aprovados para operações com dinheiro real; nenhum deploy ou ordem executados nesta etapa.