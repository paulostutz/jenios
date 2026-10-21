# JENIOS B299 — consentimento privado, revogação e proteção durável anti-replay

**Data:** 21/10/2026. **Base:** B298 certificado, commit `e74272a83e102c79118e3df9d8566e2c07526a95`, CI 39681610853 SUCCESS. Somente JENIOS Platform. Nenhum motor proprietário, B152, rota de aplicação, conexão bancária ou corretora alterado.

## Implementação e reutilização

1. `lib/platform/research/b299-private-consent-replay-journal.mjs`: verifica consentimento local assinado **Ed25519** por autoridade pré-configurada, vinculando digest de titular/conta/consentimento, ID do coletor, tipos de leitura e prazo máximo de 24 horas. O signatário do consentimento deve usar chave diferente da chave pública do coletor B298; a verificação de assinatura **não atesta que esse signatário é o cliente verdadeiro**.
2. Reutiliza `inspectB298SignedReadEnvelope`, que valida os quatro formatos já estabelecidos no B298. Nenhum conector, modalidade, política de inversão, apuração de sinais ou cálculo de risco foi reescrito.
3. `B299PrivateEvidenceJournal`: SQLite privado, em diretório externo ao repositório, pertencente ao operador, com permissões restritas (`0700` no diretório, `0600` no arquivo), WAL e transações `BEGIN IMMEDIATE`. Indexa somente **HMACs** de escopo, nonce e digest de evidência e o tipo/horário do evento. Rejeita repetição do evento mesmo após reiniciar o processo, inclusive por outro consentId do mesmo escopo. Não mantém payload de ordem, segredo nem documento do titular.
4. Revogação assinada pela mesma autoridade é registrada no diário privado e bloqueia **novos imports locais** após a revogação. Isto **não equivale a revogar permissões na corretora**; tal verificação externa permanece obrigatória.
5. `scripts/platform/research/b299-private-consent-replay-intake.mjs`: execução manual e **offline** que aceita apenas pacote assinado, chaves **públicas**, digests já configurados e diário privado. Rejeita arquivos em diretórios acessíveis a terceiros, links simbólicos, pacotes inválidos, executor real/Paper ativo e ambiente Vercel. A única gravação é o diário de evidências. Imprime relatório redigido, sem publicar dados brutos.

## Limites importantes

- Um pacote assinado comprova integridade relativa às chaves públicas **configuradas pelo operador**, não origem oficial do broker, autorização civil do cliente, entrega efetiva ou presença do motor proprietário naquele momento.
- Não há qualquer GET/POST de corretora neste B299 e não foram coletadas credenciais. A fonte externa não está homologada.
- O diário impede reutilização local de exportações na instância testada; para múltiplos hosts, serão necessários persistência compartilhada, atestado independente, controle de backup/restore, gestão de chaves e revogação externa.
- Ordem real e Paper, alteração de posição, cancelamento, cobrança, deploy e mudança na produção continuam **proibidos**.
- O Lossômetro mantém resultados reais e perdas efetivamente neutralizadas como **não verificados**. Cenários hipotéticos nunca viram fatos financeiros.

## Testes e critérios de aceite

`tests/platformB299PrivateConsentReplayJournal.test.mjs`: assinaturas válidas/inválidas, expiração, alteração de escopo, consentimento por modalidades, chaves separadas, permissões, reuso de nonce, repetição após reinício, consentId alternativo, revogação assinada e forjada, isolamento de contas, arquivo SQLite fora do repo, diretórios 0700, links simbólicos e CLI real em arquivos sintéticos sem network. Todos dados e chaves são criados apenas para teste, em memória ou diretórios temporários.

A CI executa testes B299 e B297/B298, regressão `npm run build` e arquiva somente contratos/documentação públicos. O código proprietário original continua no checkpoint privado B296/B297, fora do GitHub. **CI verde certifica contratos, nunca a conexão de corretora nem o resultado financeiro.**

## Continuidade após B299

1. Confirmar, em ambiente isolado e com autorização expressa, o vínculo da conta e as permissões de leitura em APIs **oficiais** da corretora; mapear revogação na origem e trilhas por conta.
2. Garantir logs com carimbo temporal confiável e atestado independente do coletor — o operador não pode autoassinar toda a cadeia e tratar isso como prova de terceiro.
3. Conciliar as ordens e proteções oficialmente observadas com o livro B152 em método apenas de inspeção, nunca chamada à API de envio.
4. Comprovar entrega de sinais por provedor externo, associando-os a decisões não sintéticas do motor original.
5. Manter metodologia prospectiva com preços independentes e custos verificáveis antes de qualquer alegação de eficácia, economia do Lossômetro ou piloto operacional.

**Status:** infraestrutura local anti-replay e consentimento pronta para testes; integração externa e lançamento **NO-GO**, sem autorização de execução ou faturamento.