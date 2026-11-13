# REVPUB002 — publicação limitada da gestão financeira

## Sucessora REVRATE001 — confirmação de Paulo em 13/11/2026

10% para quem contrata os planos com Reverso; 20% para quem contrata apenas o Reverso avulso, mensal ou anual. Essa regra substitui a expressão imprecisa "20% no plano de entrada" e resolve a pendência comercial de percentual. O código existente já distingue included/10% e entry/20%; a prova de contratação/inclusão por titular continua necessária. Direitos anteriores são preservados. A candidata runtime REVRATE001 complementa o mapa aprovado sem criar vínculos, saldo, ledger ou cobrança. Não é instalada por esta publicação Web.

Base imediata: REVPUB002 `2f4e89b4acb644bf9558073e1a1e4881d46c98d4`. Reutiliza o verificador de sucessoras, seu inventário limitado e a base histórica da47f251. Nada muda nas autorizações financeiras.

Pedido de Paulo em 13/11/2026: concluir os ajustes financeiros, preservar o robô e publicar somente o que estiver verificado. Base publicada: da47f25126612fe0c94241db7616b76b3852b1a3. Nenhuma fonte de execução foi substituída ou criada.

## Delta desta publicação

- Reutiliza, byte a byte, a correção de retorno do Admin da REVSRC001 1da126b1: autenticação dedicada e destino /platform/admin/robos/reverso.
- Separa assinatura, taxa de uso de R$ 5 e participação na área existente do cliente e do Admin. Explicita que comprar Reverso não concede Ultra.
- Registra fechamento mensal como decisão atual. Não converte essa decisão em aprovação implícita da base de cálculo ou da compensação de perdas.
- Mostra a taxa de R$ 5 como indisponível enquanto o evento e as regras não estiverem definidos. Não cria obrigação, reserva, ledger, débito, conta ou autorização.

## Já existia

REVFIN001/002: preços de R$ 19,90 e R$ 199, confirmação antes da vigência, direito específico, componentes CB006/Pay, carteira Letter, histórico, operações, custos, apuração, obrigações, recibos e testes fictícios. REVPUB001 já publicou a interface com financeiro bloqueado. REVSRC001 corrigiu o retorno Admin e testou composição fictícia. REVDATA001 preparou contrato diagnóstico; REVLETTER001 e REVSHARED002 prepararam patches Letter, ainda não instalados por esta publicação.

## Bloqueios preservados

1. Ultra v4 cobra R$ 5 por sessão entre Start e pausa/encerramento, não por trade. O pedido Reverso diz por operação e mesmo padrão Ultra. Sem decisão adicional, o evento permanece pendente. O consumidor Ultra existente prepara reserva única por ciclo; captura, liberação, retomada e estorno continuam dependentes de regra e homologação. Nenhum padrão de débito real foi presumido.
2. Fechamento mensal e percentuais (planos 10%, Reverso avulso 20%) estão aprovados. Ainda precisam ser definidos: agregado líquido mensal versus soma das operações positivas, perdas dentro/entre meses, contas, custos elegíveis incluindo taxa de uso, moedas/FX, arredondamento, termos/legados, ajustes e mínimo de emissão Letter. O vínculo de cada titular ao contrato é evidência técnica necessária, não nova aprovação comercial do percentual.
3. Não foi fornecida nova referência de fonte real qualificada de fills/custos Reverso. R114 conhecido é observacional/sintético; o worker Render consultado continua na 5c97e62b, com entrada r100-inert-worker.mjs. Ausência de nova referência não prova inexistência de outra fonte.
4. Assinatura produtiva ainda depende da montagem Platform → pagador Social/G47 → Letter, confirmação persistente e homologação autenticada. Não basta ativar uma flag.
5. Letter LIVE 161adb5e (PR306) foi comparada com ccd036ef: cinco caminhos de bundle público, nenhum Access.php/Ledger.php ou contrato financeiro. REVSHARED002 permanece proposta separada; isolamento e consumidores reais ainda precisam ser qualificados. Nenhum arquivo Letter foi alterado.

## Validação e publicação

Comando vigente desta release: `npm run build`. Executa verificador novo de ambiente/fonte, regressões comportamentais pertinentes e build Next. `npm run test:revpub002` permite repetir apenas essa seleção. Os testes históricos de inventário das releases anteriores permanecem intactos e vinculados às suas árvores exatas; o script `build:revpub001-snapshot` é mantido para reprodução naquela base. O sucessor confere a cadeia anterior usando os bytes pinados da base e confere separadamente cada delta autorizado. Nenhum guard de dinheiro ou de runtime foi removido.

A seleção inclui assinatura, confirmação, cancelamento, estorno observado, revogação, resposta perdida, idempotência, segregação, renderização e fronteira hospedada. Evidências PostgreSQL/concorrência dos checkpoints são preservadas, não reapresentadas como novas execuções. Nenhum teste usa ordem, débito ou cobrança real.

Esta sucessora só pode publicar na branch release/jenios-reverso-revrate001-20261113, projeto JENIOS já existente, com os mesmos controles de ambiente. Contratação, cobrança, ingestão financeira e execução Reverso permanecem bloqueadas. A publicação Web não comprova integração financeira ativa.
