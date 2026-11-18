# AGENTS.md — Diretrizes Estritas de Engenharia e Execução

Este documento define as regras obrigatórias para qualquer agente de IA operando neste repositório. O não cumprimento destas regras invalida o Pull Request / entrega.

---

## 1. FILOSOFIA CENTRAL: SIMPLICIDADE CIRÚRGICA (KISS & YAGNI)
- **Mínima Intervenção:** Resolva cada tarefa com a menor quantidade possível de linhas de código e arquivos modificados.
- **Proibição de Over-Engineering:** NUNCA crie camadas de abstração extras, padrões complexos (Factories, Adapters, Services genéricos), wrappers ou utilitários reutilizáveis para resolver um problema pontual.
- **Código Direto:** Prefira soluções explícitas, lineares e fáceis de ler em vez de soluções "elegantes" ou excessivamente modularizadas.
- **Não "Melhore" o que Funciona:** É terminantemente proibido refatorar, renomear funções/variáveis, reformatar ou otimizar trechos de código adjacentes que não fazem parte direta do problema reportado.

---

## 2. CONTROLE DE CRIAÇÃO E EXCLUSÃO DE ARQUIVOS
- **Zero Arquivos Não Solicitados:** NÃO crie novos arquivos (componentes, hooks, helpers, scripts, migrations, arquivos de configuração ou documentação `.md`) a menos que a criação tenha sido explicitamente solicitada no prompt.
- **Edição In-Place:** Sempre priorize editar arquivos existentes em vez de dividir lógicas em múltiplos novos arquivos.
- **Sem Lixo Temporário:** Nunca deixe arquivos de teste temporários, scripts de debug, backups (`*.bak`, `*_old.*`) ou logs residuais no commit final.
- **Dependências:** NÃO instale novos pacotes (`npm install`, `yarn add`, `pip install`, etc.) sem autorização prévia. Utilize exclusivamente as bibliotecas já presentes no projeto.

---

## 3. ESCOPO DE EXECUÇÃO E TRAVA DE SEGURANÇA (STOP & ASK)
Antes de escrever qualquer código, avalie o impacto da alteração. **PARE IMEDIATAMENTE e peça confirmação ao usuário** (listando em tópicos curtos o que pretende fazer) se a tarefa exigir qualquer um dos pontos abaixo:
1. Modificar mais de **3 arquivos** simultaneamente.
2. Criar qualquer novo arquivo ou pasta na estrutura do projeto.
3. Alterar schemas de banco de dados, migrations, políticas de segurança (RLS) ou variáveis de ambiente (`.env`).
4. Modificar fluxos críticos de autenticação, pagamentos, webhooks ou integrações externas.
5. Desfazer ou reescrever uma arquitetura existente.

---

## 4. PROTOCOLO DE CORREÇÃO DE BUGS E PREVENÇÃO DE LOOPS
Quando a tarefa for corrigir um erro ou falha de operação:
1. **Diagnóstico Primeiro:** Identifique a causa raiz exata no código existente antes de propor alterações. Não chute soluções nem aplique "band-aids" (como `try/catch` vazios, `any` no TypeScript ou `setTimeout` arbitrários para esconder erros).
2. **Regra das 2 Tentativas:** Se uma abordagem de correção falhar nos testes ou no build duas vezes seguidas, **PARE**. Não insista tentando variações complexas. Explique objetivamente qual é o bloqueio, o que foi tentado e aguarde instrução.
3. **Preservação de Contratos:** Mantenha assinaturas de funções, tipos, payloads de API e respostas de endpoints intactos, a menos que a tarefa exija explicitamente alterá-los.

---

## 5. PADRÕES DE CÓDIGO E IDIOMA
- **Idioma:** Todo texto visível ao usuário final (mensagens de erro, labels, alertas, copy da interface) deve ser escrito estritamente em **Português do Brasil (pt-BR)**.
- **Tipagem e Lint:** Respeite rigorosamente as regras de tipagem e linting já configuradas no projeto. Nunca desative regras com comentários como `@ts-ignore` ou `eslint-disable` para forçar um build a passar.
- **Limpeza:** Remova `console.log` de depuração antes de finalizar a tarefa.

---

## 6. VERIFICAÇÃO OBRIGATÓRIA ANTES DE CONCLUIR
Antes de finalizar a tarefa e abrir o PR / entregar o código, execute nesta ordem:
1. Rode o comando de verificação de tipos / build do projeto (ex: `npm run build` ou `tsc --noEmit`) e garanta **zero erros**.
2. Rode os testes existentes relacionados ao módulo alterado para garantir que nenhuma funcionalidade anterior foi quebrada.
3. Revise o `git diff` completo da sua alteração:
   - Há alguma linha alterada que não tem relação direta com o pedido? **Reverta.**
   - Há algum arquivo novo que não foi pedido? **Apague.**
4. **Formato da Entrega:** Ao concluir, responda de forma direta e curta contendo apenas:
   - Lista exata dos arquivos modificados.
   - Resumo técnico de 1 a 2 linhas do que foi alterado e por quê.
