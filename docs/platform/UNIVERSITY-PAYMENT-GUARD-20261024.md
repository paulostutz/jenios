# Universidade: disponibilidade durante pausa de pagamentos

Base publicada: `8d4936e0b02c39bb217ad542d01d330dc6cb71d6` (PR5 + PR6).

A contratação mensal da Universidade consultava apenas a presença das credenciais Inter e o produto ativo. Com pagamentos gerais pausados, a oferta ainda podia anunciar contratação disponível e a rotina de checkout preparar um pedido antes de o gateway recusar a cobrança.

A oferta e a admissão do checkout agora também exigem `JENIOS_PAY_PAYMENTS_ENABLED === 'true'`. A recusa ocorre antes de preparar mensalidade ou pedido. Consulta de pedido existente e acesso educacional comprovadamente pago são preservados durante a pausa.

Validação: 28 cenários focados de Universidade, proteção de ativação e Inter, incluindo flag ausente/falsa/inválida, nenhuma preparação de pedido, acesso pago preservado e consulta de pedido pendente sem nova cobrança. Fixtures independentes evitam que a desativação de um produto em um teste contamine os seguintes. Nenhuma chamada bancária ou alteração de produção foi feita nesta correção.

Integrar esta alteração à revisão coordenada G45/G46, atualizar seu manifesto de fontes e certificar a árvore combinada antes da publicação. Este documento não autoriza nem registra ativação de pagamentos.
