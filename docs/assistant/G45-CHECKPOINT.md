# G45 — franquias aprovadas e continuidade por adicional ou upgrade

## Autorização e coordenação

Em 24/10/2026, Paulo aprovou explicitamente a recomendação de US$ 2 de custo efetivo de IA por ciclo para Global Crypto e US$ 4 para Internacional Pro. Acrescentou: “E se ele estourar a franquia, ele precisará contratar a parte ou fazer upgrade de plano”. O contador existente desconta 2× o custo do provedor; portanto as franquias internas são 4.000.000.000 e 8.000.000.000 nanoUSD.

Esta aprovação substitui somente a pendência comercial dos valores de franquia descrita no checkpoint G44. Não aprova silenciosamente um preço de pacote adicional. A operação mensal sem teto mantém sua configuração. Não há autorização de cobranças automáticas por excedente, ordens, reprocessamento de e-mails ou recargas à força.

Base exata deste bloco: `dd2e6ce9d2beeea64bc63e42557da8357f0cce94`, árvore `296092eede8e9fcaa385cfb3facc690346a5dcb0`, da PR5 `fix/jenios-experience-r44-20261024`, já integrada sobre G44. Seus 1.019 arquivos são preservados fora das alterações específicas revisadas G45. Memória, refinamento comercial R44, áreas de cliente, e-mails, Banco Inter e segredos não devem regredir.

Entrega isolada para incorporação pelo Work. A branch G44, a branch da PR5, o banco hospedado, as configurações Vercel e o domínio não são alterados por esta preparação. A promoção final continua única e manual pelo Work, sobre o commit integrado e certificado.

## Regras comerciais e comportamento

- Global Crypto: até US$ 2 de custo real por ciclo, equivalente a US$ 4 no saldo interno atual.
- Internacional Pro: até US$ 4 de custo real por ciclo, equivalente a US$ 8 internos.
- O aviso de 80% inclui valores reservados, apresentados separadamente do consumo liquidado.
- A reserva de uma nova consulta precisa caber no saldo. Uma sobra positiva menor que a reserva também exige adicional, upgrade elegível ou renovação.
- Histórico e atendimento básico permanecem acessíveis quando a franquia acaba.
- Adicional pago e franquia incluída permanecem em carteiras separadas; o cliente confirma a origem e a consulta. Não há débito adicional automático.
- As novas compras de adicional exigem plano Pro vigente. Um pedido já existente pode ser conferido pelo próprio titular após o vencimento do plano, preservando conciliação e recuperação de pagamento.
- Global Crypto pode conhecer o Internacional Pro pelo fluxo de contratação existente. O plano superior não anuncia outro plano inexistente. O simples clique não modifica a assinatura nem concede saldo.
- O upgrade no mesmo ciclo conserva consumo e reservas e altera o total ao limite superior uma única vez. Uma assinatura sobreposta sem vínculo verificável exige conferência, impedindo franquia duplicada.

## Configuração e ativação

A nova migração define as franquias aprovadas e trata a reconciliação dos períodos. Ela não liga geração, pagamentos ou preço. Consumo e reservas não são apagados; incompatibilidades que impedem a aplicação segura devem abortar a transação.

As rotas de adicional reutilizam o motor B143/B146: autenticação, cotação imutável com câmbio oficial, confirmação do preço/termos, pedido vinculado, confirmação bancária e crédito idempotente. A venda só fica disponível quando as configurações comerciais e bancárias reais já estiverem aprovadas e prontas. Campos antigos de pacotes propostos continuam sem autorização de venda.

**Ainda não definido pelo proprietário:** preço e tamanho do pacote adicional. Não apresentar valores de fixtures ou propostas antigas como preços aprovados. Sugestão a decidir: um adicional que permita US$ 2 de custo real, equivalente a US$ 4 internos, vendido pelo equivalente de US$ 4 em reais na cotação oficial vigente. Essa sugestão não foi configurada nem aprovada.

OpenAI, tarifas/modelos, assinatura elegível para validação e prontidão bancária continuam exigindo conferência real no ambiente de publicação. Uma CI aprovada não prova que uma credencial existe nem que um pagamento foi confirmado em produção.

## Certificação

O workflow G45 executa os testes gerais e S05, build Next e PostgreSQL 17 descartável. A suíte G45 deve comprovar configuração idempotente, preservação de gastos e reservas, upgrade no mesmo ciclo sem duplicidade, bloqueio de sobreposição ambígua e manutenção dos gates. Os resultados definitivos e a SHA certificada são os da execução da branch isolada; não presumir conclusão antes do retorno da CI.

O arquivo `G45-INTEGRATION-BASELINE.json` fixa a árvore da base combinada, e `G45-REVIEWED-CHANGES.json` enumera os blobs alterados. O backup do workflow contém o arquivo integral da fonte Git e o respectivo SHA256. Não inclui banco de clientes, segredos, e-mails enviados nem transações financeiras.

## Integração posterior pelo Work

1. Conferir o head atual da PR5 e manter todos os avanços posteriores à base acima.
2. Incorporar este bloco em uma única linha de publicação, resolver manifestos com hashes exatos e preservar proteções.
3. Executar a CI da SHA combinada; aplicar a migração uma única vez pelo fluxo de migrações após rever seu estado.
4. Confirmar credenciais e testar memória, geração real e uso Pro com conta legitimamente elegível. Não fabricar saldo ou assinatura.
5. Definir a oferta adicional antes de habilitar pagamentos; testar seu recebimento apenas com autorização de pagamento apropriada.
6. Conferir os e-mails e promover manualmente a implantação exata aprovada, mantendo o backup e a referência de reversão.
