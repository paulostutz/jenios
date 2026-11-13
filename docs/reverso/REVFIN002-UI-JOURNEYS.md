# REVFIN002 — jornadas autenticadas do Reverso

Esta extensão parte do candidato Web `e53d946e0434a6c8d2480ecf781f4b63707389b6`. O checkpoint REVFIN001 permanece histórico e inalterado. A versão publicada reconfirmada pela frente de conciliação continua `0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47`; esta fonte é candidata local, sem merge, publicação ou ativação.

## Comportamento entregue

O cliente autenticado consulta a disponibilidade de contratação no endpoint dedicado `/api/platform/reverso/subscription`. Os cartões existentes mantêm os preços aprovados de R$ 19,90 mensais e R$ 199,00 em pagamento único por 12 meses. A vigência começa na confirmação do pagamento. Ausência de fonte autorizada mantém a seleção bloqueada e explica a indisponibilidade.

Somente um DTO recente, vinculado ao titular e explicitamente demonstrativo habilita a jornada candidata. As capacidades de cobrança, débito e execução reais precisam continuar falsas. Cotação, aceite e preparação usam a oferta exata; cadastro do pagador, titular e cliente são resolvidos no servidor. O navegador não envia identidade financeira, recibo, confirmação de pagamento, QR ou instrução de pagamento.

Uma tentativa incerta preserva a mesma chave e a oferta aceita. Consulta por `requestKey` não emite novo POST; ausência de pedido não equivale a rejeição. Repetição explícita reutiliza a mesma chave. A referência e a oferta, sem credenciais ou dados do pagador, permanecem no armazenamento da sessão da aba, separadas por titular, até a resposta validada. Se esse armazenamento não puder ser lido ou gravado, nova preparação fica bloqueada. Recarregar a página recupera a tentativa anterior antes de permitir outra. A confirmação de um pedido autoriza limpar a referência local; falha nessa limpeza também bloqueia nova contratação.

A interface distingue estado do pedido, registro histórico fictício de pagamento, início/fim de vigência e encerramento previsto. Cancelar/revogar o direito não apaga um registro de pagamento em teste nem o transforma em estorno. O encerramento de um plano manual mantém o texto “Previsto; período pago preservado”, sem afirmar renovação automática. Nenhum botão confirma pagamento ou libera acesso real.

O Admin continua usando o guard existente e consulta o titular selecionado por endpoint administrativo. Não monta as ações de contratação. Quando o shell Social Master está disponível sem a sessão exclusiva da Platform exigida pelos dados, a tela explica a sessão necessária e mantém a consulta bloqueada.

Os dois retornos nominais `/platform/reverso` e `/platform/admin/robos/reverso` foram acrescentados à allowlist existente do login. Todas as entradas anteriores e a rejeição de destinos externos ou variantes não aprovadas permanecem. A falha inicial da jornada revelou que o guard enviava o retorno Reverso para `/social`; a correção limita-se a essas duas entradas.

## Apuração e indisponibilidade

Razões validadas de indisponibilidade, atualização concorrente e política pendente aparecem na tela. Valores desconhecidos continuam pendentes; zero só é apresentado quando a fonte fornece zero. Apuração e pagamento continuam separados.

A demonstração mensal existente não comprova aprovação da política comercial do Reverso. A UI declara que unidade de apuração, custos e compensação de perdas ainda dependem de regra comercial aprovada para o Reverso. A política específica do Ultra não foi alterada nem estendida ao Reverso. Os termos nativos já existentes permanecem no fluxo demonstrativo; esta extensão não aprova uma nova regra de cálculo.

## Provas e limites

`tests/reverso-subscription-ui-v2.test.mjs` executa as páginas, os componentes, os guards dedicados, o cliente e os handlers HTTP reais em um harness local, com sessões fictícias e fonte em memória. O harness recusa origens externas, não cria usuário, não abre navegador e não envia requisições de rede.

Na primeira execução foram 14/15 testes aprovados: a única falha comprovou o retorno incorreto do login. Após a correção e os cenários adicionais, foram 22/22 aprovados. Cobrem mensal/anual, aceite explícito, clique repetido, capacidades expiradas, fonte ausente, resultado incerto, consulta/repetição, recuperação após remontagem, isolamento entre titulares, troca de sessão, histórico de pagamento e direito cancelado, Admin sem sessão exclusiva, revogação de permissão durante a consulta e pendente versus zero. Os 31 testes anteriores de UI continuam aprovados; seu harness isolado recebeu somente o stub da nova composição, enquanto o harness novo exercita o componente verdadeiro.

A anulação na fonte em memória testa a UI e o transporte. A prova da preparação central sem envio antes de `void_unsent`, da concorrência e dos efeitos nativos pertence à suíte PostgreSQL/serviço candidata, mantida separadamente. Nenhum resultado dessa fixture local é declarado como execução nativa.

`scripts/render-reverso-v2-ui-fixtures.mjs` produz 27 HTML estáticos: nove estados para revisão posterior nas larguras de 320, 390 e 1440px. Inclui cliente sem fonte, cotação mensal/anual, pedido pendente, tentativa incerta, direito cancelado com histórico de pagamento, períodos/operações e duas jornadas Admin. O diretório de evidência é externo ao Git e traz requisições sintéticas sanitizadas, hashes da fonte e manifesto próprio.

**Verificação visual de navegador: bloqueada. Capturas produzidas: 0.** O plugin Browser recusou o contexto de extensão disponível; o inventário permitido de CUA não apresentou candidata JENIOS nem sessão correspondente. Não foi fornecida URL candidata acessível e autorizada. Não se repetiram negativas anteriores de arquivo/socket, não se instalou automação alternativa e não se publicou preview. Os HTML e testes de componentes não comprovam viewport medido, overflow, contraste ou aparência final. Essa revisão visual permanece pendente.

## Fechamento da fonte

A guarda REVFIN002 preserva exatamente o verificador e o inventário de e53, além de toda a cadeia anterior. O manifesto novo fixa somente esta extensão e as substituições nominais revistas. Aprovação de integridade da fonte não concede publicação, execução, emissão, cobrança ou débito. O gate de produção e a configuração do ambiente continuam os anteriores; a build integral é coordenada pela frente principal após o freeze.
