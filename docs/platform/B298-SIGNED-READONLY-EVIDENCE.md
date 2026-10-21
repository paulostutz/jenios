# JENIOS Platform — B298: intake assinado de evidências de leitura (isolado)

**Base imutável**: B297, commit `9e9dd107e7e7a67c6d7ded6b7b1fd72cb44fdb7d`, CI `39677069427` (SUCCESS). Exclusivamente JENIOS. Sem alteração dos motores `engine.mjs` e `service.mjs`, de B152, do executor, de CHEFE ou de LETTER.

## O que este bloco realmente implementa

O arquivo `lib/platform/research/b298-signed-evidence-audit.mjs` é um **validador de exportações**: não executa solicitações de rede, não conecta contas e não possui credenciais. Aceita quatro formatos estritamente permitidos de eventos, com assinatura **Ed25519 de um coletor escolhido pelo operador privado**: `ORDER_GET` e `POSITION_GET` (contratos Alpaca **Paper**), `SIGNAL_DELIVERY` (registro declarado de entrega) e `OPERATOR_INTENT` (intenção de comando do próprio cliente).

O verificador exige chaves públicas injetadas pelo processo chamador; domínio de assinatura e serialização canônica; escopo por digests do titular/conta/consentimento; carimbo temporal válido até 2 minutos; desativação explícita dos transportes; fonte, campos, tipos e quantidade rigidamente limitados. Rejeita inconsistências, mensagens adulteradas, chaves não reconhecidas, eventos duplicados e dados extras de credenciais. **Uma assinatura do coletor não significa assinatura da corretora, nem prova de consentimento independente.** Digests de consentimento são apenas vínculos declarados até verificação externa.

### Contratos pré-existentes reutilizados

- **B197**: duas observações Alpaca Paper comparáveis; preserva estado desconhecido, fill parcial e cancelamento com exposição possível. Nenhum envio ou atualização de B152.
- **B290**: referência de inversão no modo Reverso e exceção de megatendência. Manual e Híbrido continuam sem inversão; cancelar ou fechar nunca inaugura nova exposição.
- **B297**: valida cadeia de decisões capturadas em fonte **sintética**; a assinatura de um recibo de entrega declarado pode ser correlacionada ao digest local, sem promover esse evento a prova real de recepção.
- **Lossômetro**: perdas hipotéticas evitadas e ganhos hipotéticos descartados em unidades R, com `actualBrokerRealizedPnl=null`. Proibida alegação de ganho, desempenho ou perda efetivamente neutralizada.

### Estados de segurança

O gate de integração sempre retorna `NO_GO_EXTERNAL_SOURCES_NOT_CONNECTED`. Em todos os relatórios, emissão, envio e cobrança permanecem zero. Não há leitura externa realizada por este código; a validação de assinatura não substitui autenticação do provedor nem atestado por testemunha independente. A API do módulo recusa credenciais e campos não previstos. A verificação de duplicatas é **local à chamada**; bloqueio durável contra replay depende de serviço privado ainda não implantado.

## Testes e CI

`tests/platformB298SignedEvidenceAudit.test.mjs` utiliza um par de chaves Ed25519 gerado na memória para criar **fixtures**; não armazena chaves ou credenciais. Valida adulteração de assinatura, expiração, consentimento/conta incorretos, campos proibidos, pedido com status inconsistente, fills regressivos, duas leituras, alteração de posição, entrega sintética versus recibo externo, inversão e ciclo de cancelamento/fechamento, Lossômetro e NO-GO.

O comando opcional `scripts/platform/research/b298-audit-signed-readonly.mjs` importa um pacote JSON apenas de um diretório privado externo ao repositório (arquivo e pasta com acesso restrito, chave pública local, escopos injetados por variáveis de ambiente e flag `JENIOS_B298_PRIVATE_READ_ONLY=true`). Seu único efeito é imprimir relatório redigido no terminal. Não chama serviços externos e não aceita chave privada, credenciais ou ativação de transporte.

A CI `.github/workflows/jenios-b298-readonly-evidence.yml` executa os testes B298 e gates anteriores, regressão completa, testes S05 e build sem quaisquer segredos de corretoras, arquivos de núcleo proprietário ou acesso autenticado externo. Ela certifica o **contrato de auditoria**, não o funcionamento externo de corretoras ou a rentabilidade dos robôs.

## Bloqueios para uma integração real (B299+)

1. Auditoria independente da emissão/autorização do consentimento individual e da propriedade da conta, com revogação efetiva.
2. Coletor privado isolado, oficial e de uso somente leitura; vínculo com conta e horários do provedor; rotação de chaves, persistência anti-replay e logs invioláveis externos.
3. Comprovante de entrega genuíno do provedor de notificações, com aceitação e entrega separadas, comparado a sinais genuínos de motor verificado (sem extrapolar eventos sintéticos B297).
4. Reconciliação independente de ordens, fills parciais, cancelamentos, posições, stops/metas e reservas de risco B152 — sem traduzir leituras em comandos.
5. Lossômetro separado por (a) hipótese de cenário, (b) preços/custos comprovados e (c) P&L realizado por execução atestada; nunca chamar hipótese de economia real.
6. Testes prospectivos suficientes e aprovações explícitas antes de qualquer piloto de negociação ou claim comercial.

**Sem dados externos/credenciais/consentimento verificados, a integração externa permanece NÃO HOMOLOGADA.** Nenhum deploy, cobrança, ordem real ou Paper está autorizado por B298.