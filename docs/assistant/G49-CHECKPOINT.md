# G49 — análises por foto ou print

Base exata: 319ce764682e388772989657eb33f4ae102ee304, produção G48 + M02.

O titular não possui API de cotações e escolheu leitura somente com imagem enviada. Gráfico, cenário, hipóteses e apoio manual exigem foto/print no cliente e servidor; nenhum desses fluxos consulta feeds. Busca e gráficos da Platform permanecem preservados. Nome de ativo sozinho não produz leitura atual.

As instruções separam fatos visíveis, cenários condicionais, invalidação e limites. Dados ilegíveis, ativo divergente, imagem sem gráfico e comandos escritos na imagem não autorizam inferências ou ordens. A fonte é identificada como imagem, sem inventar horário de cotação. Imagens não entram no extrato nem em evidências de clientes. Confirmação assina os bytes exatos; repetição retorna o resultado sem nova geração.

Elegibilidade, orçamento, modelos/tarifas, confirmação e conciliação foram preservados. O administrador sem assinatura vê uma mensagem específica, sem promessa de franquia ativa. Nenhuma assinatura, saldo, pagamento ou ordem real é criado pelos testes.

O verificador explícito scripts/verify-pro-image-g49.mjs --live usa apenas a chave OpenAI já configurada no ambiente de produção revisado. Envia três imagens sintéticas por meio do serviço real com livro de consumo exclusivamente em memória. Confere OCR, respostas dos dois personagens, imagem sem gráfico, origem visual, custo confirmado e idempotência. Não conecta banco, não altera clientes e não roda automaticamente nos testes/builds normais. Logs contêm somente respostas às imagens sintéticas e uso agregado, nunca segredos. Cada geração tem limite de US$ 0,20 de custo de provedor; não há repetição automática em caso de resultado incerto.

Verificações de integração preservam todos os arquivos G48 + M02 por hash e permitem somente as alterações listadas no manifesto G49. Novas alterações exigem nova revisão do manifesto. Nenhum binário nativo, chave, perfil Apple, recebimento, TestFlight ou recurso CHEFE/LETTER foi alterado.

Resultados efetivos de testes, execução real e publicação devem ser registrados no checkpoint externo da conversa após as respectivas confirmações. Não interpretar a existência do verificador como execução bem-sucedida.
