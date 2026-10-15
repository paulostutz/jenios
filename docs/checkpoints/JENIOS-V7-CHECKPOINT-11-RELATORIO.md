# JENIOS Social V7 — checkpoint 11 — 14/10/2026 (Bahia)

Base remota: dc2e27a75c4b0ddbfb6999f3ee6dcbe07d80b92d, árvore 08f71be5c9bf38590bfd382020dc27c47db04ac3. Continuidade do checkpoint 10 na branch jenios-v7-homologacao. Nenhuma promoção à main ou produção.

## Implementado neste bloco

- Gestão de atendimentos do Especialista: comprador acompanha suas contratações; especialista acompanha seus clientes. Aceite, agendamento/reagendamento, registro de entrega e confirmação do comprador; recusa com motivo e aviso explícito de que não é reembolso.
- Snapshot da oferta contratada, valor e comissão de 10% preparado no servidor antes do checkout quando a extensão está ativa. Retentativas não duplicam atendimento e alterações da oferta não reescrevem o snapshot.
- Extensão 1:1 com o pedido PAY, sem duplicar cobranças. O inventário remoto foi consultado apenas para confirmar ausência de estrutura equivalente. Nenhuma alteração remota foi realizada.
- Migração criada com CLI Supabase 2.121.0: supabase/migrations/20261015000628_specialist_order_fulfillment.sql. O timestamp do arquivo usa UTC; a data deste checkpoint é a data local da Bahia.
- RLS de leitura para comprador/especialista; cliente não pode escrever diretamente ou chamar a função de transição. RPC SECURITY INVOKER com execução exclusiva de service_role. Backend usa usuário verificado, não identidade enviada no corpo.
- Transições transacionais bloqueiam o pedido financeiro e verificam paid, partes e revisão atual. Status financeiro, referências, pagamentos e webhooks nunca são alterados por uma ação de atendimento.
- Lista paginada e histórico; interface descarta respostas de outra sessão. Salvamento do currículo também descarta resposta obsoleta após troca de conta.

## Estado de ativação — importante

A migração NÃO foi aplicada ao Supabase remoto. A extensão permanece desligada por padrão (JENIOS_SPECIALIST_ORDERS_ENABLED ausente/false). Aplicar e validar em homologação antes de ligar a flag no pacote final. O checkout anterior continua funcionando com a flag desligada; a gestão de atendimentos informa indisponibilidade, sem sucesso fictício.

Com flag ligada e extensão indisponível, falha de preparação bloqueia a chamada do gateway; pedido pendente é preservado para retentativa. Não há importação automática de pedidos pagos antigos sem snapshot da oferta.

## Verificação realizada

- 147 testes unitários/contrato/mock aprovados.
- 21 verificações em PostgreSQL/WASM isolado (PGlite 0.5.10): migração compilada, fluxos de aceite/agendamento/entrega/recebimento, papel correto, revisão obsoleta, pagamento pendente/reembolsado, RLS, revogação de escrita/RPC e preservação integral dos registros financeiros de teste.
- 26 verificações HTTP, build Next.js e git diff --check aprovados.
- Sem navegador autenticado, sem teste remoto de concorrência multiconexão, sem cobrança/repasse real e sem alteração de produção.

## Pendências preservadas

- Especialistas: instalar/homologar extensão; gestão financeira de recusas/reembolsos, repasse efetivo, avisos e criação de salas não implementados. Desempenho real da Platform segue sem integração comprovada.
- BankScore: laudo completo e entrega paga dependem dos dados financeiros complementares; não transformar indicador prudencial provisório em rating completo.
- Impulsionamento: orçamento e cobrança existentes; execução/distribuição de campanha ainda não concluída.
- Validador: consulta detalhada e PDF conectados no checkpoint 10 para escopo limitado; sem inventário completo de carteira e sem homologação paga real.
- Platform: checkout separado preservado; recorrência/liberação por assinatura ativa ainda pendente neste ambiente.
- Feed/mídia: configurações opcionais do checkpoint 08 não ativadas remotamente.
- Inter considerado validado pelo usuário; não reconstruído. Compatibilidade deste adaptador com a PAY existente continua para homologação do usuário.

Backup consolidado, não patch de instalação. Próximo bloco: avançar pendências de distribuição do impulsionamento e dados/entrega BankScore, mantendo evidência de homologação separada de testes locais.
