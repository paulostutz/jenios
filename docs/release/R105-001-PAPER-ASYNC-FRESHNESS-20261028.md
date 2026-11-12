# R105 — validade de cotação e consentimento após esperas de rede

## Falha reproduzida
O transporte Paper R77 reutilizava `nowMs` do início da operação depois de seis consultas externas. Uma cotação com limite de cinco segundos podia envelhecer durante essas consultas e ainda passar pela reserva. O teste novo com seis atrasos de um segundo falhou antes da correção: o envio ocorreu em vez de ser recusado. Os tempos do recibo também eram calculados como início mais um ou dois milissegundos.

## Correção
- Relógio monotônico acompanha o tempo transcorrido; não renova os horários originais da cotação ou do consentimento.
- R77 revalida cotação, instrumento, conta e autorização após o preflight e imediatamente antes de entregar a requisição ao transporte. Recibos usam o momento da observação.
- R78 revalida o consentimento assinado depois da aquisição durável da autorização e antes do POST.
- R80 confere o vencimento da aprovação de risco depois de receber a resposta do banco. Depois da última consulta de segurança, revalida também a assinatura e a cotação antes do transporte.
- Expiração após a reserva mantém o estado conservador UNKNOWN e o risco retido. Não há nova tentativa automática, liberação inventada de saldo ou confirmação falsa de execução.
- A proteção de CI que congelava o R77 anterior passa a conferir o SHA-256 exato da versão corrigida. As proteções das rotas, código não relacionado e migrações permanecem.

## Validação
Os testes cobrem atraso no preflight, relógio inválido/regressivo, avanço do relógio padrão, horário do recibo, cadeia assinada R78/R80/R77 com o diário SQLite real, expiração durante a aquisição da autorização, expiração durante a consulta final ao banco, acionamento do kill switch e recusa do POST. Respostas da corretora e do banco são simuladas; nenhum teste usa contas ou dinheiro de clientes.

O resultado de CI e o commit final devem ser consultados na PR #22. Esta alteração não implementa os dez conectores restantes, envio Live, estratégia automática ou cópia de segurança externa. Publicar e compilar não equivalem a homologar a corretora.

## Entrega para homologação humana
1. Preparar uma conta Alpaca Paper do titular e cadastrar as credenciais exclusivamente no cofre pelo ambiente protegido. Não enviar chaves ao chat.
2. Concluir o diagnóstico Platform, conferir a identidade da conta, aprovar explicitamente os limites e preparar um diário privado vinculado à conta. Esses passos não podem ser substituídos por registros fictícios.
3. Em sessão privada controlada, verificar o ciclo de consulta, envio Paper autorizado, confirmação, cancelamento e recuperação usando recibos da corretora. O operador R104 oferece inspeção, recuperação e cancelamento; não oferece envio de novas ordens nem configura limites.
4. Testar restauração fora do servidor e comparar ordens/posições com a corretora antes de qualquer avaliação Live.

Os sete dias gratuitos não alteram permissões de negociação nem aprovam contas. Nenhuma alteração desta entrega habilita operação financeira para clientes. Ainda há trabalho de implementação e infraestrutura além dos testes humanos.
