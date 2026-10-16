# JENIOS R30 — identidade final sem mascotes na LP

Data: 16/10/2026. Este é um checkpoint DOCUMENTAL. Os fontes atualizados constam no pacote privado da Biblioteca; produção e branch main não foram alteradas.

## Decisão expressa pelo proprietário
- **Gênio e Gênia humanos:** usar apenas em posts editoriais e no robô interno de suporte da Platform de negociações. Escolha persistente do atendente na área /platform/assistente.
- **Landing Page /lp:** NÃO apresentar imagens ou cards de Gênio e Gênia. Preservar layout, cores, copy e mensagem institucional. O slogan da Platform pode permanecer como texto.
- **Portal público:** sem os dois personagens.
- **T.Jenio (escola):** mantém tutor próprio, aulas, avaliações e progresso; sua interface não mostra avatares humanos ou seleção dos mascotes. O servidor aceita campos legados de preferência sem perder dados existentes.
- **Slogans:** Platform = “A Plataforma Que Transforma o Seu Erro Em Lucro”; Social tem outro slogan, mas a frase literal não foi recuperada com segurança. Nunca usar o slogan da Platform na Social.
- **Posts:** seis rascunhos de Platform alternando personagens e três ideias separadas da Social, SEM publicação automática. Social não recebe frase inventada.

## Verificação R30 concluída
- 538 testes de aplicação aprovados, zero falhas/ignorados; 108 testes do núcleo privado aprovados novamente.
- Sintaxe de 324 arquivos verificada e build Next/webpack concluído.
- HTML compilado da /lp examinado: zero referências genio.webp, genia.webp ou PlatformBrandMoment, slogan institucional textual presente.
- T.Jenio examinado: zero referências a imagens humanas na sua interface; rota de atendimento interna mantém seleção dos dois personagens.
- Comparado ao backup R29: 144 arquivos protegidos de Social, BankScore, Validador, PDF, PAY e outras integrações idênticos byte a byte. Somente 3 fontes preexistentes foram alterados: app/page.js, app/lp/page.js e app/components/learning/LearningRoom.js; demais adições são biblioteca de textos editoriais, testes e documentação.
- Registros, cobranças, banco, corretoras e APIs não modificados neste R30. Testes interativos em contas reais e deploy permanecem pendentes.

## Backup integral cumulativo
Arquivo privado salvo na Biblioteca: /JENIOS-Platform-R30-completo-privado.zip
Tamanho: 6.121.689 bytes; 614 arquivos.
SHA-256: 2278d4771675d6400b57151f3817faf7c1691ea88371c6f02a2fd64bbd0c80b1
Manifesto e logs completos no pacote. R25–R29 preservados em histórico. O núcleo proprietário permanece fora do repositório público.

## Estado de publicação
A main conhecida segue no SHA 8bcdef507ee2774bc24f832e1d04608fde16aea9 (R24). Conexão Vercel recusou autorização 403 anteriormente e não foi contornada; nenhuma publicação R30 foi efetuada. Esta branch contém apenas o registro do checkpoint, não a aplicação privada.
