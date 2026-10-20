# B147 — Universidade independente por R$ 49,90 mensais

## Decisão comercial

Em 20/10/2026, o proprietário aprovou a contratação da Universidade JENIOS por
R$ 49,90 por mês, sem exigir um plano da Platform. Este bloco continua o B146;
não substitui as aulas, avaliações, revisões, autenticação ou o JENIOS PAY.

| Acesso | Universidade | IA Pro |
| --- | --- | --- |
| Visitante | Pode conhecer a oferta; contratação exige conta | Crédito Pro separado; geração depende de ativação aprovada |
| Conta sem plano da Platform | R$ 49,90 mensais, contratação opcional | Créditos separados |
| Plano de R$ 99,90 | R$ 49,90 mensais, contratação opcional | Créditos separados |
| Plano de R$ 149,90 | Incluída enquanto o plano estiver vigente | Franquia limitada, ainda dependente dos valores e orçamento aprovados |
| Plano de R$ 199,90 | Incluída enquanto o plano estiver vigente | Franquia limitada, ainda dependente dos valores e orçamento aprovados |

Gênio e Gênia gratuitos continuam acessíveis na Social, inclusive sem login.
A mensalidade independente da Universidade não concede saldo ou franquia Pro.

## Contratação e renovação

- Página própria: `/universidade`.
- Login e cadastro reaproveitam o formulário original. Os acessos educacionais
  retornam à Universidade; o destino padrão da Social continua o mesmo.
- Preço fixo: 4.990 centavos de real por mês de calendário.
- Produto próprio: `social-university-monthly`, categoria `other`, moeda BRL,
  periodicidade `monthly`. O passe legado de 30 dias permanece separado.
- Cada pagamento exige confirmação expressa do preço e dos termos pelo aluno.
- O meio disponível é Pix, com renovação por iniciativa do cliente a cada mês.
  Nenhuma instrução de débito automático ou recorrência bancária é criada.
- O período começa no recebimento confirmado. A renovação antecipada preserva
  os dias já pagos e o dia original de vencimento, inclusive na transição de
  meses com 28, 29, 30 ou 31 dias.
- Para deixar de renovar, o aluno não inicia outra mensalidade. O período pago
  mantém sua validade, sujeito à confirmação do pagamento e a eventual estorno.
- O progresso dos estudos permanece no armazenamento existente e não é apagado
  pelo vencimento ou renovação da contratação.
- Uma mensalidade futura já paga é distinguida de acesso vigente. Um intervalo
  decorrente de estorno não oferece uma nova cobrança que apenas adie ainda
  mais o início do acesso.

## Contrato financeiro e de acesso

A página utiliza três rotas privadas em `/api/assistant/university`:
`access`, `checkout` e `status`. A autenticação real do servidor identifica o
titular. As respostas usam `private, no-store` e não incluem dados de outros
usuários.

O checkout genérico bloqueia esse produto. A contratação educacional exige o
valor exato de 4.990 centavos, BRL e a versão dos termos aprovada. Um plano com
Universidade incluída bloqueia uma nova contratação separada.

A tabela `jenios_university_invoices_b147` conserva o vínculo entre consentimento,
pedido, recibo e período educacional. A preparação serializa operações por
usuário. Dois cliques, duas abas ou duas chaves simultâneas retomam o mesmo
pedido pendente; não criam duas cobranças independentes. O transporte Pix
original mantém o identificador determinístico da cobrança.

Uma marcação isolada de pedido pago não concede acesso. A confirmação requer
titular, produto, preço, moeda, metadados, recibo bancário confirmado e
identificador de pagamento correspondentes. A confirmação repetida não estende
o mês novamente. A evidência de um período pago é imutável. O acesso revalida
pedido e recibo, inclusive após estorno.

Uma resposta perdida conserva o pedido. O aluno pode retomar sua solicitação ou
consultar o recebimento sem iniciar outra compra. Pagamentos confirmados cuja
liberação ainda esteja em conferência são apresentados como pendentes de acesso,
sem crédito ou acesso otimista. A entrada na sala de estudos também recupera a
liberação de um pagamento já confirmado.

As tabelas possuem RLS e não concedem acesso a `PUBLIC`, `anon` ou `authenticated`.
As funções financeiras usam `SECURITY INVOKER` e execução restrita ao servidor.
O B147 revoga também privilégios excessivos herdados pelo `service_role` nas nove
tabelas Pro, restaurando somente os conjuntos de leitura/inserção/atualização
previstos pelo B143. Não remove registros nem altera saldos ou configurações.

## Preservação e verificação

- Permanecem as cinco trilhas, 15 aulas, avaliações, revisões e isolamento do
  progresso implementados nos blocos anteriores.
- As rotas e o transporte originais de JENIOS PAY permanecem preservados.
- Social, BankScore, Validador, TradingView e o núcleo dos robôs permanecem
  protegidos pela verificação de integridade do pipeline.
- A alteração compartilhada no formulário de autenticação limita-se ao destino
  após sucesso, com lista fixa de destinos permitidos e padrão `/social`.
- O pipeline executa regressão unitária, regressão da Social, build Next,
  navegação em Chrome e testes PostgreSQL 17.
- Os testes PostgreSQL usam somente o banco descartável
  `jenios_pro_b143_test`: calendário, preço, recibos, replay, estorno, mês futuro,
  plano incluído, permissões e sessões simultâneas.
- Os testes de simultaneidade verificam um pedido pendente por titular, uma
  única liberação por recibo, preservação dos dias na renovação e isolamento de
  contas. Não utilizam banco de produção nem contato com o provedor financeiro.

## Instalação e estado operacional

Este documento descreve o contrato do código. Ele não substitui o comprovante
de CI, migração ou deployment da revisão exata que for publicada.

Em produção, o núcleo privado Pro B143 foi instalado em nove transações curtas
com guardas de privacidade em cada commit, preservando as 45 instruções do SQL
original. A conferência registrou nove tabelas privadas, geração e vendas Pro
desativadas, franquias e orçamento zero, nenhum saldo ou registro financeiro
criado. O hardening B147 e o produto mensal devem entrar somente após sua CI.

O produto mensal da Universidade é independente dos interruptores de vendas
Pro. Sua disponibilidade requer o catálogo aprovado e a configuração já
existente do Pix. Uma migração não comprova validade de credenciais bancárias,
recebimento real nem pagamento real.

Continuam dependentes de decisão separada: valores das franquias Pro dos planos,
valor e moeda do pacote inicial, limites de gasto da API e por consulta, modelos
autorizados, credencial protegida e autorização de ativação da geração paga.

Nenhum procedimento deste bloco exige criar pedido de cliente, efetuar
pagamento, conceder crédito Pro ou executar análise generativa em produção para
verificar a publicação.
