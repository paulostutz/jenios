# JENIOS G44 — ativação dos assistentes com a produção integrada

Data: 24/10/2026. Branch: `release/jenios-genios-g44-20261024`.

## Autorização e fontes preservadas

O proprietário autorizou executar o restante da ativação, validação real e publicação de Gênio/Gênia. A orientação posterior de saldo OpenAI de US$ 10, recarga ao chegar a US$ 5 e ausência de teto mensal operacional também abrange a JENIOS. Essa política não cria franquia ilimitada por assinante, não modifica os preços dos planos e não autoriza ordens, pagamentos ou envios de teste como efeito colateral.

A base dos assistentes é G43 `15bff4f432cc45f61b2d32fd0aa29a45e8366c3c`. Durante a retomada, o Work publicou R43 na branch dos e-mails, commit `43283a1833e8c9527f452a29fa5912b910ed5a00`, árvore `523f7abbfd97c213431c47e7a768b867e0100922`. Seus 19 arquivos novos/alterados foram incorporados integralmente, sem reescrever as correções de acesso, navegação e simulação. O manifesto G44 compara a entrega com os 956 arquivos dessa produção. Não integrar branches dos robôs de negociação, CHEFE ou LETTER.

## Refinamentos finalizados

### Extrato Pro

A tela mostra até 50 consultas autorizadas pela API, com estados, origem do consumo, data, valor exato e resposta concluída expansível. `hasMore` informa a existência de registros anteriores; não há paginação fictícia. Erro, ausência de configuração e histórico vazio são estados distintos. Troca de conta e logout descartam respostas antigas. O acesso ao histórico não depende de continuar com plano ativo. Compras e recargas não fazem parte deste extrato; créditos antigos são identificados como históricos, sem reabrir a venda de créditos avulsos.

### Reparo contextual sem nova cobrança

A RPC `jenios_assistant_repair_context_g44` separa inspeção e aplicação. Confere dono, canal, expiração, chave, fingerprint, ledger liquidado e resposta original; a aplicação usa CAS e grava resposta, referências oficiais e resumo atomicamente. Não gera outra resposta nem altera o ledger. Um reparo antigo não substitui o resumo de uma conversa que já avançou. Dados relatados permanecem não verificados. Falha ou conflito mantém `conversationSyncPending`, inclusive em um turno G43 previamente marcado como concluído.

### Operação sem teto mensal fixo

O modo `uncapped` é explícito, com `capped` preservado para compatibilidade. No suporte, ambiente e política persistida precisam concordar; as RPCs nova e antiga compartilham contador e lock. No Pro, o contador mensal admite limite nulo no modo sem teto. Permanecem reserva por solicitação, contagem de tokens, limites por chamada, 12 reservas por visitante/hora no suporte, direitos de plano, franquias, ledger, dispatch único e conciliação. Nenhum número artificial é apresentado como orçamento ilimitado.

A orientação de recarga do provedor não comprova disponibilidade da credencial na aplicação nem sincroniza os ledgers entre produtos. A configuração B143 lida em produção ainda tinha geração desligada, modelos/tarifas não aprovados e franquias zero. A documentação comercial anterior contém proposta de US$ 2/US$ 4 por ciclo, sem decisão final recuperada para os valores; não convertê-la silenciosamente em regra aprovada.

## Escopo de implantação

G44 usa somente o projeto `jenios-ecossistem`, ID `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4`. O guard mantém a G43 restrita e permite a nova release exata:

- Preview: Social/PAY `rebzztxlzofxpfwjvbee`; URLs públicas e de servidor da Platform `xaicvhagftzjkqphnbgx`; e-mails, Inter, pagamentos, Paper e ordens desligados. A geração pode ser habilitada nessa homologação autorizada quando as configurações e credenciais forem verificadas.
- Produção: Social/PAY `igayfjorjmucthlfoasf`; Platform dedicada já usada pela R43; gates S05, segredos de servidor e projeto correto obrigatórios.
- Memória ligada requer schema certificado e segredo de sessão. Geração ligada requer os segredos e o modelo correspondentes. O log de build G44 registra apenas presença de configuração, nunca valores de credenciais.

Na nova implantação de produção, `JENIOS_EMAIL_PRODUCTION_BRANCH` precisa acompanhar a branch G44. Preservar credenciais, agendador, quotas, consentimento, flags já ativadas pelo Work e o corte temporal original `JENIOS_EMAIL_DELIVERY_START_AT`. Os deployments existentes conservam sua configuração original; não redefinir o corte de entrega nem reprocessar a fila antiga.

## Migrações e retenção

Ordem conferida em homologação:

1. Schema privado B143 original (`db/schema/pro-wallet-b143.sql`), ausente na QA e já instalado na produção. Bootstrap aplicado somente onde faltava, com geração/pagamentos desligados.
2. `20261024201548_jenios_assistant_conversations_g43.sql`.
3. `20261024202054_jenios_assistant_sales_budget_g43.sql`.
4. `20261024210637_jenios_assistant_pro_context_repair_g44.sql`.
5. `20261024210740_jenios_assistant_operational_budget_g44.sql`.

As quatro migrações de assistentes e o pré-requisito B143 foram aplicados na QA por suas interfaces oficiais. A memória fica em tabelas com RLS, sem SELECT para anon/authenticated. As RPCs de reparo, orçamento e limpeza têm execução restrita ao servidor. A conferência remota das permissões passou. O job `jenios-assistant-cleanup-g44` executa `jenios_assistant_cleanup_g43(500)` aos minutos 7, 22, 37 e 52 de cada hora. A chamada inicial retornou zero exclusões. O prazo de acesso continua aplicado imediatamente no banco.

Configuração operacional na QA:

```sql
UPDATE public.jenios_sales_policy_g44 SET monthly_budget_mode='uncapped',updated_at=now() WHERE id=true;
UPDATE public.jenios_pro_config_b143 SET monthly_budget_mode='uncapped',updated_at=now() WHERE id=true;
```

Essas alterações não ligam geração nem concedem franquia. Não reaplicar a migração antiga B282 que também altera Inter/Vault. A próxima conferência deve consultar tabelas/RPCs e histórico de migração antes de instalar qualquer estrutura.

## Evidências e certificação

As revisões independentes cobriram UI, guard, orçamento e reparo. O extrato passou em 14 cenários de browser local com contas/APIs simuladas. O reparo passou em PostgreSQL real descartável, incluindo concorrência, ledger inalterado, CAS e preservação de assunto posterior. O orçamento passou em 12 blocos SQL, incluindo concorrência entre a RPC antiga e nova, alternância de modo e liquidação de uma chamada já enviada após reduzir o teto.

O workflow `jenios-genios-activation-g44.yml` verifica fonte, suíte completa, S05, build e três bancos PostgreSQL 17 independentes (G43, reparo G44 e orçamento G44). Preserva fonte exata em ZIP, SHA256, commit, manifesto, checkpoint e logs. Consultar a execução pelo SHA final; resultados de G43 não certificam automaticamente G44.

O relatório operacional final deve registrar CI final, deployments e banco realmente ativados, testes reais do provedor, custos observados e pendências. Este checkpoint descreve a fonte candidata e a preparação já comprovada; não é declaração antecipada de produção ativada ou de qualidade de modelo real.

## Continuação e reversão

Conferir novamente a produção e o head da branch do Work antes da publicação. Preservar qualquer atualização posterior a `43283a1`. Ativar memória após conferência do banco/limpeza; validar perguntas reais no ambiente aprovado; certificar a versão exata e publicar a implantação testada. O Pro exige assinatura real e franquia definida; Master não cria saldo. Não fabricar assinatura ou pagamento para demonstrar funcionamento.

Rollback inicial: desligar as flags novas e retornar a implantação anterior se necessário. Preservar ledger, histórico e as correções R43; não restaurar banco sobre dados novos. Agendamento da limpeza faz parte da política de retenção e deve continuar coerente com as conversas já criadas.

Fontes técnicas conferidas em 24/10/2026: [tarifas OpenAI](https://developers.openai.com/api/docs/pricing), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Supabase Cron](https://supabase.com/docs/guides/cron), [promoção na Vercel](https://vercel.com/docs/deployments/promoting-a-deployment). A tarifa do projeto para Luna/Sol permaneceu compatível com a tabela Standard consultada; disponibilidade na conta exige validação de runtime.
