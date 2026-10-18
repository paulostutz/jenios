# S05-B01 — Next.js LTS (somente homologação)

A base anterior Next.js 14.2.3 recebeu avisos de vulnerabilidades que não podem ser corrigidos integralmente por patch da linha 14. A recomendação oficial de 14/10/2026 indica Next.js 15.5.28 (Maintenance LTS), ou 16.4.1 (Active LTS). Escolhemos a transição menos extensa para Next 15.5.28, fixada no package.json, somente na branch isolada. **Não alterar produção.**

Fontes: https://nextjs.org/blog/nextjs-security-update-october-14-2026 ; https://vercel.com/changelog/next-js-may-2026-security-release

A fonte do projeto fixa react ^18 e mantém as rotas existentes; compilação e testes remotos na Vercel são obrigatórios. `package-lock.json` da base permanece da versão anterior enquanto npm local sofre EAI_AGAIN; isso impede classificar o upgrade como pronto para merge. Atualizar e validar lockfile no ambiente de rede antes de promoção; nenhum merge nem produção autorizado no S05.
