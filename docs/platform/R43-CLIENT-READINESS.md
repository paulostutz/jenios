# R43 — acesso direto e revisão dos comandos do cliente

Base: produção R42 `e9926d975a48c72ac3815de6fc6d3bdae717d7c5`. Escopo ampliado expressamente pelo proprietário para revisar telas, APIs, busca, gráficos, comandos e simplificar controles sem efeito.

## Correções

- Dashboard, Mesa, diagnóstico, Universidade e assistente da Platform passam pelo verificador de sessão remota antes de exibir seus controles. `/dashboard-logado` conserva a proteção existente.
- A entrada direta da Platform oferece primeiro o formulário da conta JENIOS Social. O acesso exclusivo da Platform permanece uma opção explícita; nenhuma senha é tentada automaticamente em outro banco. Retorno após login limitado a caminhos internos permitidos.
- Busca compartilhada identifica corretamente B3, pares cripto/Forex e ações conhecidas; aceita `BOLSA:ATIVO`. Entrada inválida ou bolsa desconhecida mostra mensagem sem trocar o gráfico por um ativo diferente.
- Compra/venda fictícias conservam a quantidade no diário. O laboratório acompanha pausa/retomada da tela e confere a pausa novamente antes de executar um replay histórico.
- Retirados do Dashboard o botão sem efeito “Simular Proteção” e os campos de alavancagem/stop diário que não eram usados pelo registro de intenção. Avisos de operação aparecem na página. Textos da Mesa deixam de afirmar que existe alvo/stop automático.
- Corrigida a falta de privilégios nas nove colunas usadas pela API existente de especialistas. Concessão ao servidor aprovada expressamente pelo proprietário; sem acesso adicional a `anon`/`authenticated`, sem DELETE e com RLS preservado.

## Validação e limites

API pública de especialistas passou de 503 para JSON válido com lista vazia. Candles BTC, ETH e SOL retornaram 200 com 200 amostras completas; ativo inválido retornou 400. APIs privadas recusaram consultas sem token. As respostas públicas e o teste manual dos gráficos/controles estão no checkpoint da revisão.

Não foram ativados pagamentos, teste gratuito, conectores de corretoras ou operações reais. Os provedores Binance/Alpaca continuam com implementação de leitura demonstrativa desabilitada; os demais oferecem guias. Sessão Social permite simulação e não concede privilégios da Platform, diagnóstico privado, assinatura ou administração no banco dedicado. Isso exige uma etapa própria de integração certificada.

E-mails da R42, quotas, consentimento, corte temporal, agendamento e credenciais permanecem preservados. A lista exata dos arquivos desta revisão está fixada por hash em `R43-CLIENT-READINESS-BASELINE.json`; a checagem da publicação continua verificando os demais arquivos contra a base anterior.
