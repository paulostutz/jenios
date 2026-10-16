# JENIOS R39 — robôs: validação adversarial e comprovação do loss evitado

Data: 16/10/2026 — CHECKPOINT DOCUMENTAL SEM DEPLOY.

## Produção e código confidencial
- Main observada no GitHub: 8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10 (R35).
- Social, BankScore, Validador e JENIOS PAY permaneceram protegidos e inalterados, tal como os 501 arquivos da aplicação R38 original.
- O único arquivo anterior do núcleo privado alterado foi nucleo-privado/validation-r38.mjs (correção de janelamento temporal). As regras de geração de sinais do motor original não foram adaptadas para melhorar retrospectivamente os retornos.
- Nenhuma alteração na main, dados bancários, Supabase, pagamentos, contas, corretoras ou negociações reais.

## Testes efetivamente concluídos
- 334/334 testes do núcleo privado; zero falhas e zero ignorados.
- 674/674 testes da aplicação; zero falhas.
- 355 arquivos passaram na verificação de sintaxe, build Next.js de QA aprovado.
- 38 cenários de mercado INTEIRAMENTE SINTÉTICOS, 414.720 candles artificiais e 2.655 oportunidades espelhadas; 1.047 oportunidades fictícias em período de teste. 36 conjuntos têm menos de 50 sinais por holdout individual.
- 200.000 dimensionamentos determinísticos de risco; nenhuma violação de orçamento e limite nocional nos cenários testados.
- Correção de replay com mais de 10 mil candles intradiários; equivalência de preços, resultados R e motivos de saída testada.
- Comparação real da função chooseMode em intenções e mercados inventados: hybrid pior que a intenção simulada em 8/38; reverse não calibrado pior em 5/38; reverse calibrado hipoteticamente pior em 7/38.
- Comparador exploratório walk-forward fixado, separado do motor proprietário: 1.338 decisões de manter, 4 inverter, 1.313 não operar; 555 com histórico insuficiente. Carteiras fictícias do comparador melhor que referência direta em 14/38, iguais ou piores em 24/38. Exposições diferentes: isto não prova vantagem causal.
- Relatório de loss contrafactual mostra perdas potencialmente evitadas, lucros sacrificados e novas perdas provocadas pela intervenção, incluindo casos negativos. Nenhum loss real de cliente comprovado.
- Testes de integrity-check do ZIP e checksum oficiais não equivalem a verificação de origem externa: sem validação independente da proveniência, resultados não podem ser chamados de históricos reais.

## Backup cumulativo privado
- Biblioteca: /JENIOS-Platform-R39-VERIFICADO.zip
- Arquivo ZIP local: JENIOS-Platform-R39-completo-privado.zip
- Tamanho: 10.952.740 bytes, 803 entradas ZIP, incluindo manifesto; 802 arquivos de conteúdo verificados por SHA-256 individual, zipfile.testzip sem erros.
- SHA-256 do ZIP: fa01ef26509419899569aca5aeb4d881b866ae80df5eb6c13a672d70f795de97
- PDF de relatório principal: documentacao-r39/RELATORIO-VALIDACAO-ROBOS-R39.pdf, 4 páginas. R25–R39 preservados. Não enviar código proprietário ao GitHub público.

## Pendências determinantes
1. Dados históricos reais de fonte verificada (arquivos ZIP + CHECKSUM originais para BTC/ETH/SOL, 1h/5m) com auditoria de origem e calendário.
2. Congelar estratégia e premissas antes dos testes fora da amostra; modelar taxas, spread, slippage, liquidez, gaps, funding e falhas operacionais.
3. Piloto prospectivo sem dinheiro real: registrar intenção original do usuário, decisão anterior ao preço futuro e fills simulados rastreáveis, com avaliação independente.
4. Medir resultados financeiros líquidos pareados incluindo perdas novas, ganhos sacrificados e exposição comparável.
5. Autorizar negociação real somente após homologação de corretora, risco e governança.

Resultado do gate: technicalQA=PASS; marketProfitabilityVerified=false; clientLossAvoidedProven=false; realExecutionEnabled=false; deployment=NO_GO; realMoney=NO_GO.
