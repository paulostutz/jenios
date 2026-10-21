# B295 — Evidência real do runner privado: checklist de aceite

Base B294 certificada em CI 39667841162, commit 0fa65e673c0f7b8d80ad7e4c325b79fb99ea7dad.

Este bloco adiciona somente uma verificação de completude para o futuro runner privado. **Não inicia o runner, não acessa seu executável, não atesta SHA real, não recebe sinais genuínos e não executa ordens.** Até a coleta das evidências, o gate retorna NO-GO.

A homologação funcional requer: ambiente isolado; hash dos bytes do executável; relógio testemunhado; saídas autênticas de Manual, Híbrido e Reverso; sinais antes do alvo; confirmação de entrega; consentimento do operador para leitura; controles B152; bloqueio de transporte real/Paper; fonte independente de mercado.

Mesmo com checklist completo, é necessária auditoria independente dos anexos. Nunca promover o resultado de testes sintéticos como prova de funcionamento do núcleo ou lucratividade. Não há deploy, cobrança nem alteração do código proprietário.
