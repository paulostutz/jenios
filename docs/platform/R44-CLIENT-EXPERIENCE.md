# R44 — Revisão da experiência dos clientes

Base publicada: R43, commit 43283a1833e8c9527f452a29fa5912b910ed5a00. Preserva a ativação R42, o acesso compartilhado Social/Platform e as permissões já aplicadas.

## Correções
- Dashboard e Mesa compartilham busca por nome ou código. Petrobras apresenta PETR3 ON e PETR4 PN. Catálogo dos atalhos suportados, comparação sem acentos e opção BOLSA:ATIVO para outros símbolos. Nome ambíguo exige escolha; erro preserva o gráfico anterior.
- Valores fictícios nas telas de operações, resumo da conta e laboratório usam R$, milhares e centavos brasileiros, inclusive durante a digitação. Quantidades continuam inteiras.
- Hub central e Social usam a mesma seleção aprovada (MegaPulse e Baleias); Dashboard deixa de exibir tendências de busca já retiradas no B127. O radar existente permanece nas três superfícies.
- Radar consulta amostra global e amostras por rede (Ethereum, Base, BNB Chain, Solana), até 100 pools antes de deduplicar. A consulta global anterior trazia somente pools com menos de 2 minutos, incompatíveis com o mínimo de 15 minutos. Os critérios de idade, liquidez e atividade foram preservados. Há identificação de cobertura parcial, consulta e estado vazio. Pool novo não confirma criação do token nem previsão de valorização.
- Notícias preservam a última leitura em falhas, evitam consultas sobrepostas e pausam com a página oculta. Consulta RSS a cada 30 segundos quando visível; não é streaming nem garante novas matérias a cada consulta. Removida coleção estática antiga não utilizada.
- O exercício da Social reutiliza o questionário educativo existente, eliminando somas repetidas ao voltar, rótulos psicológicos, afirmações de risco iminente e cadastro pessoal sem finalidade. O ranking semanal vazio não oferece mais um botão para uma classificação inexistente.
- LP explica os recursos atuais, adiciona entrada direta no simulador e comparação de planos. Mantém preços aprovados e limitações de execução real.
- Painel Inter trata resposta HTTP de erro antes de renderizar as variáveis, preservando a última configuração visível.

## Verificação
Testes focados de busca, reais, cobertura e limites de ambiente. Navegador local: busca Petrobras com escolha explícita PETR3; valor digitado tecla por tecla de 100000,50 exibido 100.000,50 e número 100000.5. Build local anterior ao último ajuste: 1.265 testes gerais, 94 de publicação e Next compilado. CI do commit final deve confirmar o conjunto final.

Consulta pública em 24/10/2026 21:43 UTC: 82 pools únicos, 23 na faixa etária, cinco fontes respondendo; nenhum candidato atendia a todos os filtros. Notícias responderam às 21:20 e 21:43 UTC, com as mesmas matérias disponíveis no RSS. Datas de publicação preservadas.

## Limites e trabalhos simultâneos
Produção Inter: certificado válido e correspondente; chave Pix ausente e provedor não selecionado na leitura administrativa. Proprietário está cadastrando INTER_PIX_KEY diretamente na Vercel Production. Nenhuma cobrança ou pagamento foi criado. A conexão efetiva e a emissão bancária ainda não estão certificadas.

Integração coordenada com G44 publicada (9eb3a528120149abe2e09acc6f2d5c740c2f451d). Preserva memória contextual, migrações já aplicadas, isolamento, limites e configurações. O outro chat confirmou a pausa de novas publicações enquanto a PR5 é integrada. O verificador R44 usa os 1.008 arquivos dessa versão publicada como base e hashes exatos para cada alteração revisada; nenhum motor financeiro/e-mail/corretora ou migração está liberado para alteração.

A liberação R44 em Preview é restrita à branch exata fix/jenios-experience-r44-20261024, projeto jenios-platform-homologacao, Supabase Social staging e Platform dedicado. Geração paga, cobranças e disparos externos ficam bloqueados nesse ambiente. Nenhuma proteção de produção foi removida.

Fonte técnica da ampliação por rede: https://www.coingecko.com/learn/how-to-track-new-tokens-onchain (consulta em 24/10/2026).

## Atendimento comercial

O atendimento guiado e as instruções do modelo usam qualificação por necessidade, benefícios verificáveis, resposta direta a objeções de preço, tempo, complexidade e confiança, e um próximo passo claro. Referências curtas como “B3” após uma comparação preservam o contexto; recusa encerra ofertas e sugestões comerciais; cancelamento e login continuam sendo suporte. Relato de dificuldade financeira ou tentativa de recuperar perdas interrompe a venda. Preços, memória, orçamento, franquias e gates de geração permanecem os da G44; a falta de chave OpenAI não é mascarada como geração ativa.

A abordagem de perguntas e valor usa como referência metodológica o material público da Huthwaite (https://www.huthwaiteinternational.com/spin-methodology, consulta 24/10/2026). Não representa certificação, reprodução do treinamento ou prova de aumento de conversão nesta aplicação. Não há descontos, depoimentos, escassez, lucro ou franquias inventados.

Validação adicional: conversas de múltiplos turnos exercitam objeções, escolha do menor escopo, Universidade separada, desistência, cancelamento com nome de plano, dificuldade financeira e contratação direta. A certificação final será feita sobre o commit combinado, distinta da CI inicial 40135599914.

A página legada /planos foi encaminhada ao checkout oficial. Removidos seus códigos Pix fixos, alegação de liberação imediata e recursos de execução não homologados; os links antigos de e-mails continuam válidos e passam pelo catálogo e disponibilidade atuais. A copy de encerramento da LP enfatiza estudo e método.
