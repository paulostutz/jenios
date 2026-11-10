# R125: decisão pendente sobre titularidade e operação pela plataforma

## Direção atual e estado preservado

Direção expressa do usuário: contas individuais ficam exclusivamente nos outros robôs da JENIOS; Ultra e operações Kivoryn utilizariam a conta de Paulo. Esta distinção substitui a proposta anterior de conexão individual dentro do Ultra. O código de UI individual preservado neste checkpoint ainda não implementa essa direção e não deve ser publicado como produto concluído. Não houve mudança nos outros robôs.

Este checkpoint não implementa uma conta central para operações de terceiros. As rotas anteriores são preparações locais por conta/ambiente do titular, com execução desabilitada. A preferência atual é Genial; Binance permanece alternativa opcional. A API de cripto Genial não está comprovada.

A possibilidade de clientes utilizarem a plataforma enquanto as ordens são executadas na conta de Paulo muda o modelo operacional. Não é equivalente a cada titular conectar sua própria conta. A interface de uma operação normal não estabelece autorização, titularidade, segregação financeira ou viabilidade contratual.

## O que existe e o que não resolve

- A autenticação da Platform limita consultas e gravações ao usuário autenticado. Os relatórios R124 mantêm uma conexão/ambiente por visão e verificam quantidade completa de registros.
- A intenção durável e os diários R118–R120 vinculam eventos a uma conta/produto e IDs exatos de ordem nas simulações. Eles evitam que uma resposta desconhecida seja tratada como permissão para reenvio cego.
- Um fingerprint compara vínculos, mas não prova titularidade, consentimento do beneficiário ou autorização da corretora.
- Os campos de usuário, dispositivo, magic e clientOrderId não criam contas segregadas na corretora. Uma conta com netting pode combinar exposições de robôs, operações manuais e outros usuários no mesmo instrumento.
- Os totais existentes não são uma contabilidade de alocação entre beneficiários. Custos ainda desconhecidos permanecem pendentes; não são distribuídos arbitrariamente.
- O saldo da corretora não é a carteira da Platform. A preparação de cobranças do R124 continua não faturável e não autoriza saque, transferência, captação ou débito.

## Caminhos distintos a avaliar

1. **Uso próprio de Paulo:** Paulo é o titular e beneficiário das operações. Pode haver interface web de acompanhamento, mas a conta, os limites e as decisões continuam sendo dele. A passagem para execução ainda depende de transporte nativo, elegibilidade, proteção e conciliação demonstrados no ambiente adequado. Não foi realizada aqui.
2. **Clientes enviando instruções ou recebendo resultados na conta de Paulo:** exige definir a relação, quem detém o capital, quem toma a decisão, quem suporta prejuízos, quem recebe resultados e quais permissões concretas existem. A corretora precisa confirmar um canal/arranjo oficial que comporte essa finalidade. Uma senha compartilhada ou um login único não substitui essa confirmação.
3. **Contas/subcontas segregadas em serviço oficial:** somente se o provedor oferecer e autorizar esse modelo. A disponibilidade dessa funcionalidade para Genial ou Binance e a elegibilidade da conta específica não foram verificadas neste checkpoint.

Não há conclusão jurídica neste documento. A avaliação do arranjo deve ser feita com a corretora e profissionais habilitados antes de aceitar recursos, ordens ou compromissos de clientes. Nenhuma mensagem externa foi enviada em nome do usuário.

## Requisitos técnicos independentes para qualquer arranjo multiusuário aprovado

- Identidade verificável do titular e do beneficiário; permissões por usuário e escopo, revogação e auditoria.
- Intenção imutável antes do envio, chave idempotente e mapeamento verificável de ordem/execução/posição/beneficiário.
- Fonte nativa de posições, ordens e fills; reconciliação após reinício, desconexão, execução parcial, cancelamento e resposta desconhecida.
- Limites globais da conta além dos limites individuais; reservas de margem; prevenção de concorrência e de interferência entre robôs e operações manuais.
- Política explícita de alocação de fills, perdas, taxas, funding, ajustes e encerramento. No netting, redução de uma posição não pode ser atribuída a um cliente apenas por tag.
- Proteções e suspensão que não fechem ou modifiquem a exposição de outro beneficiário sem autoridade apropriada.
- Credenciais fora do navegador e dos arquivos de cliente, no componente autorizado do titular, com controle de acesso específico. Este checkpoint não migra nem provisiona credenciais para esse arranjo.

## Próximo passo e limites

A conta pretendida para Ultra/Kivoryn já está definida como a de Paulo. Primeiro esclarecer o papel dos clientes: se envolve instruções, capital ou benefícios de terceiros, e confirmar o modelo oficialmente suportado para essa finalidade. Até lá, preservar os adaptadores e testes locais existentes, sem redesenhar a execução como conta central. Depois, especificar o contrato e os testes de segregação antes de habilitar qualquer caminho real.

Nenhuma conta foi conectada, credencial criada/importada, ordem transmitida, captação habilitada, contrato aceito ou publicação executada neste delta. Os testes são de software com dados fictícios; não comprovam homologação de conta, estratégia ou arranjo multiusuário.

## Regra solicitada de limite e saque: somente desenho simulado

A intenção do usuário é encerrar a exposição quando a conta individual chegar a zero e permitir saque de lucro. Nesta arquitetura ainda não aprovada, é necessário distinguir o saldo interno atribuído a um participante da conta real agregada de Paulo.

Na simulação, o gatilho de limite produziria estados separados: `limite_detectado`, `novas_entradas_bloqueadas`, `reducao_solicitada`, `resultado_desconhecido` quando aplicável, `reconciliando` e, somente com comprovação das execuções, `exposicao_encerrada`. O gatilho não registra um fechamento fictício nem zera saldo por conveniência. Não há nova tentativa automática diante de resposta desconhecida sem conciliação.

Chegar ao limite não garante saída exatamente em zero: gap, slippage, falta de liquidez, atraso, custos e liquidação podem produzir perda adicional ou saldo negativo. Débitos pendentes não desaparecem por causa do encerramento da posição. Em conta com netting, reduzir exposição deve considerar o inventário agregado e a atribuição de todos os participantes; uma tag não dá autorização para fechar exposição de outro.

Uma solicitação simulada de saque não é pagamento. Só poderia reservar valor calculado a partir de resultados realizados conciliados, custos conhecidos, obrigações, garantias e reservas existentes, sem dupla utilização em ordens ou saques simultâneos. Lucro aberto, taxas/funding desconhecidos ou resultado de ordem incerto não entram como lucro disponível. Também seria necessário definir destino, titular/beneficiário, processo do prestador e regras de liberação. Nada disso foi aceito, cobrado ou pago aqui.

Esses estados são uma especificação para eventual simulação após a definição do modelo. Não foram adicionados um mecanismo de saques, um livro financeiro multiusuário, uma garantia de perda máxima ou um fechamento real ao checkpoint R125.
