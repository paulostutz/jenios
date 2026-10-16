# JENIOS R33 — grade da Social, persistência e perfil independente

Data: 16/10/2026. Registro de retomada após interrupção de transmissão.

**Natureza:** checkpoint documental. A aplicação completa R25–R33 e o núcleo privado estão no pacote do proprietário; não foram aplicados à branch `main` por este checkpoint. SHA de produção observado: `8bcdef507ee2774bc24f832e1d04608fde16aea9`.

## Distinção importante
- A grade de **3 miniaturas quadradas** dentro de `/social` já consta na versão R24 da main (`app/social/profile-grid.css` importado pelo layout), com prioridade sobre a antiga regra mobile de uma coluna.
- Foi constatado que a página autônoma `/social/perfil/[id]` na base R32 ainda listava posts verticalmente e só mostrava os primeiros 20.
- R33 corrige **somente** a rota autônoma e acrescenta CSS isolado: 3 colunas, miniaturas quadradas, modal da publicação, imagens/vídeo, Escape, `nextOffset` e prevenção de duplicidades após paginação e trocas de conta.
- O fluxo de gravação não foi modificado; a API já lista posts persistidos do autor, não arquivados, com paginação.

## Verificação de armazenamento real (somente leitura)
- Supabase: 4 posts armazenados, todos vinculados a perfis; 1 post visível em `@paulostutz`.
- 2 posts com imagens associadas a objetos reais no bucket público `social-media`; URLs HTTPS persistentes, sem `blob:` / `data:`.
- Políticas RLS de INSERT, SELECT e arquivamento examinadas; nenhum dado de usuário foi alterado.
- Isto comprova a existência dos registros/objetos e o código de grade, não um E2E autenticado no iPhone.

## Reexecução concluída
- **610 testes da aplicação** aprovados (0 falhas, 0 ignorados); incluem 18 específicos R33.
- **108 testes do núcleo privado** aprovados (0 falhas).
- **339 arquivos** passam em verificação de sintaxe.
- Build Next.js 16.4.2 Webpack aprovado, com ambiente de QA fictício.
- Smoke HTTP do build local: `/social/perfil/[id]` **200**, `/social` **200** e `/api/social/profiles?id=...` sem token **401**. Servidor local encerrado.
- Capturas de grade estática 390/1440px preservadas, mas **Chromium interativo bloqueado/timeout** — não declarar teste completo de navegador ou iPhone.
- Frente à R32, somente `app/social/perfil/[id]/page.js` e `app/social/profile-grid.css` foram alterados; criados `tests/socialR33StandaloneProfile.test.mjs` e `tests/socialR33ProfilePersistence.test.mjs`. **Zero arquivos de aplicação anteriores removidos**.
- APIs de posts/perfis, feed principal, páginas de pagamento, BankScore, Validador, PDFs, JENIOS PAY, e núcleo privado mantidos byte a byte.

## Backup completo e verificado
- Biblioteca do proprietário: `/JENIOS-Platform-R33-completo-privado.zip`.
- Tamanho: **6.678.603 bytes**, **680 entradas** ZIP, **679 arquivos** no manifesto.
- SHA-256: `45dab5e33b9d0eff0386e37b25c33aa832c4f45eff77cab439a52ad458b5f830`.
- Integridade ZIP e SHA-256 de cada arquivo verificados; inclui R25–R33, aplicação integral, núcleo privado separado, testes, documentação, logs e capturas estáticas.

## Publicação
- A main permanece em R24; a correção autônoma da R33 está no ZIP e não no deploy atual.
- Vercel não tinha autorização (403 de acesso à equipe `jenios` em checagens anteriores). Não contornar bloqueio. Após autorização, criar preview isolada, testar autenticado em Safari/iPhone e desktop e só então promover para produção.
- Nenhuma ordem real, cobrança, operação bancária ou mensagem externa foi enviada.
