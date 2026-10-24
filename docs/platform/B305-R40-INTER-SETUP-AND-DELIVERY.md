# JENIOS B305 R40 — configuração Inter e preparação de entregas

Data: 24/10/2026. Base certificada: R39, commit `88f99f6fdef08891971d662aa2be55808a5f0d9c`.
Branch de homologação: `fix/jenios-b305-finance-email-20261022`.
Backup preventivo: `backup/jenios-b305-r39-before-inter-r40-20261024-88f99f6`.

## Pedido e limites

Retomar dos backups sem repetir ações, executar o próximo bloco e verificar se o cadastro de Client ID, Client Secret e ZIP do Banco Inter está pronto; aproveitar o procedimento do CHEFE quando necessário. O trabalho mantém produção, CHEFE, LETTER e evolução dos robôs separados. Nenhuma credencial real, cobrança, e-mail externo ou chamada de IA paga foi usada nesta implementação.

O estado certificado do commit R40, os resultados de CI, o deployment e os checksums finais ficam no checkpoint externo desta rodada. Este documento explica o comportamento e as condições para operar, sem afirmar uma homologação bancária ainda não realizada.

## Referência consultada no CHEFE

Fonte: `paulostutz/chefe-homologacao`, branch `fix/chefe-cp372-production-ai-inter-20261023`, commit `4d251caee59233244dfa581267e617a34d303fc1`, diretório `checkpoints/CP372/preview-site`.

Arquivos: `commerce-cp289.mjs`, `api/inter-config.js`, `api/inter-diagnostic-cp316.js`, `lib/inter-material.cjs`.

Procedimento reaproveitado: um botão **Conectar Banco Inter**, validação do ZIP, consulta de autenticação, gravação protegida e limpeza dos campos após a tentativa. O CHEFE usa cobrança por boleto V3; a JENIOS conserva seu transporte Pix e seus escopos existentes. Credenciais, certificados e configurações de um projeto não foram copiados para outro.

Referências primárias consultadas: [portal Inter](https://developers.inter.co/), [criação da integração](https://developers.inter.co/docs/introducao/como-criar-uma-aplicacao), [Supabase Vault](https://supabase.com/docs/guides/database/vault), [funções de banco](https://supabase.com/docs/guides/database/functions) e [changelog Supabase](https://supabase.com/changelog). As páginas antigas de referência Pix/OAuth do Inter devolveram o portal geral; não foram usadas para afirmar mudanças de contrato bancário. O transporte Pix existente foi preservado e testado com requisições locais simuladas.

## Cadastro Inter

Tela: `/admin/cobrancas`, seção **Banco Inter da JENIOS**. O componente fica dentro da proteção Master e pode carregar mesmo que a consulta de catálogo falhe.

Campos:

1. Client ID.
2. Client Secret.
3. ZIP original do Inter, até 512 KB, contendo um certificado e a chave privada correspondente.
4. Chave Pix recebedora da JENIOS.
5. Número da conta, opcional.

A chave Pix não pode ser obtida do certificado. O envio usa HTTPS e o endpoint privado `/api/admin/inter/setup`. A abertura da tela faz somente leitura dos metadados; nenhuma consulta bancária é disparada automaticamente.

### Conectar

O POST `action: connect` exige `confirmBankConnection: true`. O servidor verifica sessão Master, permissão financeira, origem, JSON, limite do corpo, campos exatos, ZIP e correspondência/validade do certificado e da chave. O parser existente mantém os limites contra travessia de diretórios, links, arquivos ambíguos, conteúdo criptografado e expansão excessiva.

Antes da chamada bancária, uma reserva persistente limita conexões a três tentativas por minuto. O servidor lê a versão atual, autentica o material apresentado e faz GET de uma referência Pix inexistente. Não chama criação de cobrança. Somente um 404 emitido pela consulta Pix **após autenticação** é aceito; um 404 do OAuth falha.

Depois do teste, `jenios_inter_store_verified_r40` compara a versão atual com a versão lida. Usa o mesmo lock do escritor B283 e salva Vault + estado autenticado em uma única transação. Falha de autenticação preserva a configuração anterior. Uma mudança concorrente causa conflito, sem sobrescrever silenciosamente a nova configuração.

O caminho legado `action: save` continua disponível por compatibilidade, sem prometer autenticação. A interface principal usa `connect`.

### Testar configuração salva

O botão usa o material já cadastrado, sem pedir novo ZIP. O limite é um teste a cada 30 segundos. O servidor verifica o fingerprint carregado e só registra sucesso para a mesma versão/fingerprint consultada, com certificado ainda válido. Uma rotação durante o teste não autentica a configuração substituta.

### Respostas e interface

O navegador recebe somente configuração presente/ausente, resultado do último teste, versão, datas, fingerprint e sufixos. O servidor usa projeção explícita e mensagens humanas; erros brutos ou campos extras do RPC não são devolvidos.

Campos e arquivo são limpos após cada tentativa. A interface cancela requisições ao desmontar, ignora respostas de operações antigas e não conserva um sucesso desatualizado após falha. Conexão confirmada não é tratada como homologação de cobrança. Cobranças continuam desativadas pelos gates existentes.

## Banco aplicado e validação

Projeto: Social QA `rebzztxlzofxpfwjvbee`. B283 já estava instalado; nenhuma instalação duplicada foi feita. Antes da mudança havia zero configurações Inter. A migração local foi criada pela CLI oficial e alinhada ao registro remoto:

`20261024164335_jenios_b305_inter_setup_r40.sql`.

Os três RPCs novos usam `security definer` e `search_path` explícito. `PUBLIC`, `anon` e `authenticated` não podem executá-los; `service_role` pode. A tabela de tentativas tem RLS e privilégios apenas para o servidor. Os advisors não apresentaram novo WARN relacionado ao Inter; os avisos de outras funções Social permaneceram fora deste escopo.

A regressão PostgreSQL `tests/sql/jenios_inter_setup_r40_regression.sql` foi executada no QA: limite de tentativas, gravação inicial, conflito de escritor antigo, fingerprint incorreto, reteste correto, rotação, reteste antigo e material inválido. Ela usa dados sintéticos, recusa banco com configuração existente e termina com ROLLBACK. Resultado final: zero configurações e zero tentativas persistidas. O teste não chama o banco Inter.

Em 24/10/2026, a consulta agregada de acesso confirmou **zero usuários Auth e zero Masters no Social QA**. É necessário disponibilizar uma conta Master legítima nesse ambiente para a aceitação autenticada e o cadastro pelo usuário. Não foram criados usuários/sessões por SQL, nem alteradas permissões para contornar esse requisito.

## Universidade e configuração central

`university-subscription.mjs` reutiliza o loader existente do Vault quando não há configuração de servidor completa. Oferta e nova cobrança exigem `JENIOS_PAY_PROVIDER=inter_pix`, `JENIOS_PAY_PAYMENTS_ENABLED=true` e `JENIOS_INTER_CHARGES_ENABLED=true`.

Sem esses gates, o serviço para antes de ler o Vault ou preparar pedido. A consulta de um pedido pendente do próprio usuário pode continuar conciliando um Pix já existente quando novas vendas estão pausadas. Pedidos pagos/encerrados dispensam banco; acesso já pago não depende da disponibilidade do Vault. Recibo ausente mantém `paid_pending_access` e não produz uma nova cobrança.

Preço, termos, consentimento, titularidade e idempotência são preservados. A renovação da Universidade continua manual por um mês de calendário. Isso não implementa Pix Automático nem resolve, por si só, o ciclo comercial Platform ↔ PAY. O bloqueio do checkout mensal genérico da Platform permanece.

## Preparação de e-mails para produção

Os workers financeiro, transacional e de marketing passam a reconhecer um escopo explícito de produção, desligado por padrão. A política exige ambiente, projeto, branch e URL Supabase esperados, exclui os ambientes QA conhecidos, exige flags QA explicitamente falsas e `CRON_SECRET` configurado. Os gates de cada canal continuam obrigatórios.

O financeiro resolve o destinatário pelo Auth administrativo e exige identidade confirmada, proprietário do pedido, pagamento, valor, transação e recibo consistentes. QA mantém o destinatário permitido e lote de um. O runner privado continua exclusivamente QA.

Novo endpoint: `GET /api/internal/email/finance`, protegido por Bearer `CRON_SECRET`, antes de abrir banco. Exige modo produção, limita o lote a três, recusa HEAD e retorna somente contagens. Nenhum cron foi adicionado. `vercel.json`, o cron dunning existente e as APIs congeladas S05 foram preservados.

A newsletter agora tem idempotência por edição + destinatário normalizado. Antes de ativar, tentativas antigas ambíguas precisam de conciliação para evitar reenvio após a mudança de chave.

Esta preparação não equivale a entrega operacional certificada. Permanecem: configuração de produção, agendamento financeiro, aceitação de entrega externa e estado das filas. Marketing também precisa resolver a concorrência da janela de frequência entre duas edições do mesmo usuário e definir cota global; o limite por lote não é uma cota global. O painel `email-health` continua sendo diagnóstico de homologação e exige gates fechados, não um certificado de operação de produção.

## Próxima retomada

Consultar primeiro o checkpoint R40 e o commit/CI/deployment nele registrados. Não repetir a instalação B283 ou R40 nem os cadastros já existentes.

1. Disponibilizar acesso Master legítimo no Social QA e executar a aceitação autenticada.
2. Usuário cadastrar Client ID, Client Secret, ZIP e chave Pix na tela protegida; verificar a resposta real do Inter.
3. Homologar pagamento/recibo e liberação de acesso de forma controlada antes de abrir vendas.
4. Completar vínculo Platform ↔ PAY e seu ciclo mensal; concluir e-mails operacionais e configuração/aceitação generativa.
5. Consolidar a liberação de produção após essas evidências. O deployment deste bloco deve continuar sendo Preview.
