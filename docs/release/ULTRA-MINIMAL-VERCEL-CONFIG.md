# Configuração Vercel mínima e rastreada

O diagnóstico do deployment `dpl_3z7g3zNpeGWm1MkRsvxximgzWc76`, fonte `4b87c95`, identificou zero alterações rastreadas e somente `vercel.json` não rastreado. O conteúdo gerado no build não pôde ser consultado pela API de arquivos e não foi aceito como exceção.

Esta extensão adiciona `vercel.json` contendo somente `$schema: https://openapi.vercel.sh/vercel.json`, exatamente a forma mínima oficial documentada em https://vercel.com/docs/project-configuration/vercel-json na seção de autocompletar schema. Nenhum campo de build, instalação, framework, variáveis, rotas, domínio, proteção ou acesso foi definido. Os comandos e settings existentes permanecem intactos.

O arquivo pertence agora ao inventário e tem blob fixado na guarda. Não se presume que a plataforma deixará de reescrevê-lo: qualquer modificação posterior permanece sujeita ao bloqueio de checkout alterado e à validação exata de conteúdo. Não se ignora `vercel.json` e nenhum conteúdo gerado desconhecido é autorizado. A nova guarda preserva e executa integralmente sua predecessora.
