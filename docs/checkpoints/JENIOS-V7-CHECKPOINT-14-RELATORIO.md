# JENIOS Social V7 — checkpoint interno 14 — 14/10/2026 (Bahia)

Base remota 9c2819a8c4cf39ff79a2fecc908f35e792ac0a71, árvore a1757d7c380aa77531c63a22bc49e4aff6a8e944. Branch jenios-v7-homologacao. Não é entrega final. Main, produção e integração Inter preservadas.

## Hub corrigido

- Cache em memória por processo: leitura válida por dez minutos, deduplicação de chamadas concorrentes e espera após falhas. Não constitui limitação de cota distribuída entre instâncias.
- Dados anteriores podem permanecer por até uma hora em falha do provedor, explicitamente desatualizados e com fonte indisponível. Falha não renova horário nem apresenta fonte online. Após expiração não há dados reutilizados.
- Chave opcional CoinGecko Demo/Pro apenas no servidor e em cabeçalho; host fixo, sem redirecionamentos ou exposição de erros brutos. Respostas ao navegador não são armazenadas em cache HTTP.
- Tela cancela requisição anterior, ignora resposta obsoleta e consulta a cada 60 segundos somente enquanto visível. Horário corresponde à consulta no servidor, não ao instante de atualização do mercado.
- Painel legado deixa de chamar volume agregado de fluxo institucional e deixa de apresentar tendências de pesquisa como lançamento de ativos. Reutiliza a mesma fonte e identifica falhas.
- B3/Futuros e baleias permanecem indisponíveis: não há fonte verificável conectada. Consulta direcionada ao histórico não recuperou provedor, contrato ou metodologia previamente acordados; checkpoint 04 não os continha. Não substituir por dados de cripto ou sinais inventados.

## Verificação

185 testes automatizados e 37 verificações HTTP aprovados. Build Next.js e git diff --check aprovados. Consulta local à fonte CoinGecko retornou disponibilidade durante a verificação; isso não homologa disponibilidade contínua nem implantação remota.

Teste visual preparado em scripts/test-social-ui.mjs, incluindo estados válido/desatualizado/recuperado com dados sintéticos. NÃO executado: instalação de Chromium falhou por arquivo de download inválido. Teste financeiro de navegador também não executado; seletor de planos corrigido. Não declarar QA de navegador aprovado.

## Dependências ainda abertas

Mantidas todas as pendências reais do checkpoint 13: base e metodologia BankScore completas, recorrência e liberação por assinatura ativa da Platform, instalação das migrações/flags de Especialistas e Impulsionamento, homologação autenticada, limites do Validador e revisão de segurança. Nenhuma migração, tabela ou configuração remota alterada neste bloco; nenhuma cobrança real emitida. Cobranças serão testadas pelo usuário após entrega, conforme solicitado.

Escolha de fonte de B3/Futuros e fluxo institucional exige decisão de escopo/provedor, inclusive eventual contrato e credenciais. Não contratar serviço, inventar metodologia ou afirmar integração completa sem essa decisão. Relatório interno no repositório para continuidade; nenhum pacote provisório entregue, conforme instrução mais recente do usuário.
