# B148 — Impulsionamento, escolha do assistente e validações do B147

Base: 5094cf21005549973664b619307472139ea98a57. Escopo exclusivo JENIOS.

## Entrega

- Impulsionamento mantém publicação própria e pagamento confirmado no servidor.
- Seleção agora carrega POST_FIELDS e decodifica mídia com publicPost; mostra texto, fotos, carrossel e vídeo sem gerar imagens fictícias.
- WhatsApp: Brasil +55 primeiro, país/DDI selecionável e campo de DDD + telefone. O wa.me é montado automaticamente e validado.
- Idade (faixa opcional 18–120) e sexo opcional são parte da cotação/fingerprint e do target persistido da campanha. São filtrados no servidor antes da leitura do post e da emissão do comprovante de exibição.
- Visitantes informam demografia voluntariamente no formulário de publicidade. Não há inferência por nome, foto, IP ou dados privados. A ausência de dados impede campanhas com o respectivo filtro. Dados demográficos não são adicionados ao perfil público.
- A seleção demográfica filtra a lista de candidatos do serviço já existente (até cinco por consulta); não há promessa de alcance ou preenchimento integral.
- Direct muda somente de posição, para o rodapé esquerdo; lógica de mensagens e permissões preservada.
- O assistente gratuito pede uma escolha explícita. Nome e imagem do personagem escolhido ficam no botão, com troca disponível. Visitantes guardam apenas o identificador no navegador. Contas conectadas também guardam a preferência em user_metadata, exclusivamente como preferência visual, nunca para autorização. Conversas e credenciais não são persistidas pela preferência. Mudança de conta limpa a conversa visível.

## Auditoria operacional em 20/10/2026

Produção B147: produto da Universidade ativo, BRL 4.990 centavos, periodicidade mensal. Carteira Pro instalada, geração e pagamentos Pro desativados. Não houve concessão de créditos nem geração paga.

A API pública de produtos do deployment B147 retornou checkoutReady=false e paymentsEnabled=false. Isso bloqueia a emissão de cobrança independentemente do objetivo escolhido. O formulário B148 apresenta a indisponibilidade e não cria pedido enquanto o gateway ou a veiculação não estiver pronto.

O transporte financeiro preservado oferece Pix Inter ou checkout externo configurado; este bloco não implanta emissão de boleto bancário, não cadastra credenciais e não ativa serviços financeiros. Configuração bancária válida e autorização operacional continuam necessárias. Catálogo ativo NÃO equivale a pagamento operacional.

## Verificações

Regressão unitária completa; integração Social S05; Next.js; navegadores desktop e mobile; isolamento de contas, escolha persistente e troca; composição do WhatsApp; público inválido/desconhecido; vinculação do público ao fingerprint; leitura através das políticas de acesso; readiness sem segredos. PostgreSQL descartável repete todas as verificações B143–B147 de carteira/Universidade, recibos, mensalidades, concorrência e privilégios.

Nenhum pagamento real, cobrança emitida, comunicação por WhatsApp, chave de API, crédito concedido ou operação financeira real é necessário aos testes. As simulações autenticadas de navegador utilizam somente contas fictícias interceptadas em localhost.

O backup é o arquivo integral de fonte do commit aprovado, acompanhado do hash SHA-256 e deste relatório. A aprovação final depende da CI do SHA exato; este documento não substitui seu resultado nem afirma liquidação bancária real.
