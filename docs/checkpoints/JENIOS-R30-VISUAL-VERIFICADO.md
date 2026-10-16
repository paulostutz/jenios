# JENIOS Platform — R30: marca e mascotes (checkpoint verificado)
Data: 2026-10-16.

## Diretriz final confirmada pelo proprietário
- **Landing Page /lp:** não exibir, importar ou alternar Gênio/Gênia. Preservar layout e cores; manter somente a copy da Platform.
- **Posts editoriais:** mascotes humanos Gênio/Gênia alternam por publicação. São rascunhos internos; nenhum post foi publicado.
- **Atendimento interno da Platform de negociações:** o usuário escolhe Gênio ou Gênia. A preferência não oscila automaticamente durante o atendimento.
- **T.Jenio:** permanece módulo educacional. Sua interface não usa retratos Gênio/Gênia nesta revisão; compatibilidade das preferências antigas é preservada.
- **Platform:** slogan literal "A Plataforma Que Transforma o Seu Erro Em Lucro".
- **Social:** slogan independente; frase literal não confirmada. Nenhum slogan da Platform deve ser copiado para Social.
- Não inserir mascotes em portal público e não modificar APIs Social/BankScore/Validador/PDF/PAY.

## Pacote privado preservado
Arquivo na Biblioteca: `/JENIOS-Platform-R30-VERIFICADO.zip` (cópia de verificação, a Biblioteca também já tinha uma cópia sob nome R30).
Arquivo conferido localmente: `/mnt/data/JENIOS-Platform-R30-completo-privado.zip`.
SHA-256 do ZIP: `194d421b8a408c2cf3e77c0652c33f2bc011b517ae02d1ec40b24bce4d7fe1d1`.
Tamanho: 6.121.743 bytes; 614 arquivos. CRC do ZIP: sem falhas.
Contém aplicação completa cumulativa R25-R30, núcleo de pesquisa separado, documentação, testes e manifesto de integridade. Não publicar núcleo proprietário em repositório público.

## Testes verificados após correção da LP
- Aplicação: 538 testes, zero falhas/cancelamentos/ignorados.
- Núcleo privado: 108 testes conforme resumo final R30.
- Sintaxe: 324 arquivos.
- Build otimizado: aprovado.
- HTML compilado da LP: checagem indica ausência de mascotes.
- 144 fontes protegidas comparadas sem diferenças; duas fontes preexistentes modificadas nesta correção final: `app-completa/app/lp/page.js` e `app-completa/app/page.js`.
- Manifesto final consultado em `R30-final-verification.json`.
- Testes locais não equivalem a E2E autenticado no navegador, iPhone ou produção.

## Publicação e limitações
Produção `main` verificada na revisão R24: `8bcdef507ee2774bc24f832e1d04608fde16aea9`.
Não houve push do código R30 para main nem deploy confirmado. O acesso à Vercel havia retornado 403 no escopo `jenios`; exige autorização e homologação antes do release.
Este commit GitHub contém apenas documento de checkpoint; os fontes cumulativos estão exclusivamente no pacote privado da Biblioteca.
