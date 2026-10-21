# B294 — autenticação de mensagens do runner privado, sem afirmar execução do core

Reaproveita o contrato HMAC B92 já existente para conferir três envelopes (direct, reverse, hybrid) sobre o mesmo ativo, instante e hash de observação. **Autenticidade da mensagem não é prova de que os bytes do motor privado foram executados**, nem de que sinais chegaram ao cliente. Não há acesso a corretora nem alteração no núcleo.

A origem autenticada do HMAC depende do segredo do runner privado, que não está disponível nem foi solicitado neste teste. Fixtures usam segredo falso local. Para certificação de ponta a ponta faltam um runner privado isolado com identidade SHA verificada, exportação consentida somente leitura, registro de sinal e confirmação independente de entrega.

Os nomes `direct` e `hybrid` do B92 são contratos legados de pesquisa e não equivalem aos modos comerciais Manual e Híbrido. Sem deploy, ordens, cobrança ou afirmações comerciais de rentabilidade.
