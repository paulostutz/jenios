# JENIOS Mobile — M02

Versão integrada para teste em Android e iPhone. Decisões do titular em 24/10/2026: um único aplicativo, escolha inicial **Social / Platform**, mesmos fluxos existentes e mesmas contas de publicação Apple Developer e Google Play utilizadas pelo CHEFE. Cada abertura nova apresenta a escolha; voltar às áreas mantém a instância de navegação enquanto o app está aberto.

Este incremento é uma base de desenvolvimento, ainda **não é uma versão pronta para envio às lojas**. A interface inicial é React Native/Expo 58. Os fluxos existentes abrem em WebView no aparelho; a prévia web explica sua limitação e oferece acesso à versão web. Não foi feita uma reconstrução nativa completa da Social ou Platform.

## Executar e verificar

Node 24.13 ou superior. `npm ci`, `npm test`, `npm run typecheck` e `npm run export`. Para desenvolvimento, `npm start`; para prévia de navegador, `npm run web`.

`expo export` gera os pacotes JavaScript/Hermes para Android/iOS e os arquivos web. **Não gera APK, AAB, IPA, assinatura de distribuição ou aprovação das lojas.** Essas etapas ainda precisam de um ambiente nativo e da associação do novo aplicativo às contas existentes.

## Fluxos preservados

- Social aponta a `/social`.
- Platform aponta a `/platform/entrar?next=%2Fdashboard-logado`, preservando a verificação de conta do site.
- A sessão Social permite a área de simulação conforme o contrato já publicado; ela não vira credencial administrativa, diagnóstico privado, vínculo financeiro ou plano pago.
- Nenhum segredo de servidor, senha, token de sessão ou chave de assinatura é incluído no projeto. Não há ponte JavaScript para copiar credenciais entre contas.
- Navegação principal interna só aceita HTTPS nos dois domínios oficiais. Destinos externos exigem escolha explícita no app e abrem em navegador separado. URLs com credenciais, esquemas locais e HTTP são rejeitadas.
- Os avisos de conexão, erro e tentativa novamente são nativos. Back do Android retorna pela navegação ou às duas áreas.
- A sessão do app é independente da sessão já aberta no navegador do computador. Persistência, recuperação e encerramento devem ser testados em dispositivos reais.

## Referência de produção

Site G47: `dec6ae5965b443ed0b8baabf05f750e33b403067`; deployment `dpl_GQC3o6CgWXZnPDVDwWwVycjPaZp9`. M02 acrescenta a entrada instalável /mobile.html e corrige o contato de suporte; não altera o banco. Pix continua bloqueado, com teste bancário real adiado pelo titular. Não repetir a publicação G47.

## Publicação e validações que faltam

1. Associar o identificador proposto `br.com.jenios.app` às mesmas contas do CHEFE, verificando disponibilidade, equipe Apple e organização Google. Não usar o identificador, perfil ou chave de upload do CHEFE como se fosse o mesmo app. Os checkpoints CHEFE CP385/386 foram consultados; o último registro Google aponta verificação empresarial/D-U-N-S pendente. Não foi conferido o estado atual do Console nesta etapa.
2. Fechar a experiência móvel além do contêiner web: mídia/câmera/microfone, arquivos/PDF, compartilhamento, suspensão, notificações, acessibilidade e estados de sessão. Validar Social, Platform, TradingView e busca em Android/iPhone instalados, inclusive sair/reabrir/trocar conta. Não declarar esses testes concluídos pela prévia web.
3. Definir e implementar o tratamento de assinaturas digitais nas lojas antes da submissão. O Pix do site não deve ser copiado automaticamente como compra dentro do app. Inventariar também CTAs de planos/recargas nos fluxos web incorporados. A existência de WebView não dispensa as regras de compra das lojas.
4. Validar exclusão de conta, denúncias/bloqueios, consentimento de IA, privacidade e permissões com a experiência móvel efetiva; preparar credenciais de revisão com autorização específica, sem incluir segredos no backup.
5. Finalizar ícones de loja em resolução adequada. O ícone atual foi copiado do site e é provisório para desenvolvimento; nenhuma imagem nova foi aprovada.
6. Gerar builds nativas e homologar em aparelho antes de assinar/distribuir. Xcode completo não está instalado neste Mac (há somente Command Line Tools).
7. Resolver/reavaliar os alertas de dependências de ferramentas antes de assinatura/distribuição. A auditoria registrou duas causas, expandidas em cinco entradas: `node-forge@1.4.0` (GHSA-86w9-cpqp-85rv) e `zod@3.25.76` (GHSA-mrhx-c7xc-m3w5), ambas via Expo CLI. Sem correção compatível aplicada: não fazer downgrade para Expo 44 ou substituir Zod 3 por 4 cegamente, nem suprimir auditoria. Não há certificados de assinatura nem serviço Expo dev exposto à rede neste checkpoint.

## Referências consultadas

- Expo: https://docs.expo.dev/get-started/create-a-project/
- WebView e seu contrato de tipos: https://github.com/react-native-webview/react-native-webview/issues/3970 (generic vazio explícito evita o default `undefined`, sem remover tipos ou mudar dependências).
- Apple: https://developer.apple.com/app-store/review/guidelines/ (experiência do app e compras digitais).
- Google: https://support.google.com/googleplay/android-developer/answer/10281818?hl=en-en.
- Expo CLI: https://github.com/expo/expo/issues/51773.

Não prometer aprovação automática nem tratar esta base como a entrega final do aplicativo integrado.

## Execução M02

Identificador Apple registrado: `br.com.jenios.app`, App Store Connect `6826729191`, equipe `JTJS54L3SK`, mesma conta CHEFE. Compilação via Expo prebuild + GitHub Actions, seguindo a infraestrutura CHEFE já autorizada; não há conta EAS adicional. Diretórios nativos são gerados pelos plugins, sem edição manual. Android release deliberadamente sem assinatura até conferência do artefato. Assinatura e upload são etapas separadas, sem executar dependências com os segredos.

A tela inicial mantém a navegação M01 já validada, sem migrar o fluxo existente para Router neste incremento. Há compartilhamento de links sem query/hash, salvamento de PDFs oficiais com confirmação, cache privado limitado a cinco PDFs de até 20 MiB, limpeza após 24 horas na próxima exportação e contato explícito com o suporte. As permissões de mídia são pedidas pelo sistema quando usadas. Câmera, gravação, login persistente, PDFs e widgets devem receber aceite em aparelhos reais antes da distribuição pública.

Validação: `npm run typecheck`, `npm run lint`, `npm test`. O wrapper `expo lint` apresentou incompatibilidade ao carregar a configuração ESM; usamos diretamente o ESLint recomendado pelo Expo com configuração CJS. Os avisos conhecidos do Expo CLI permanecem registrados acima.
