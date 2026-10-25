# M02 — aplicativo integrado JENIOS

Base do site: G47 `dec6ae5965b443ed0b8baabf05f750e33b403067`. Preservar todos os contratos de acesso, configurações e migrações. Pix real continua bloqueado e o teste do titular foi adiado.

Entrada única Social/Platform em `/mobile.html`, instalável pelo Safari/Chrome. Manifesto, ícones, orientação de instalação e fallback offline. O worker só armazena arquivos públicos listados; não guarda APIs, respostas de autenticação, páginas privadas, feeds, cotações ou URLs assinadas. Alternância de áreas disponível no modo instalado. Suporte corrigido: contato real por e-mail, sem confirmação fictícia de ticket ou prazo inventado.

Código nativo em `native-app/`, Expo 58 / React Native 0.88. Dois destinos existentes, domínio HTTPS restrito, URLs externas confirmadas, retorno Android, tratamento offline e erro, compartilhamento sem query/hash, PDFs limitados e confirmados. Perfis não conferem direitos pagos nem acesso administrativo. Compilação Android/iOS sem segredos; assinatura apenas após conferência do artefato. As duas variantes precisam de validação em dispositivo real para declarar câmera, áudio, persistência de sessão e widgets homologados.

Apple: mesma equipe CHEFE `JTJS54L3SK`; App ID `br.com.jenios.app`; App Store Connect `6826729191`. Google Play público aguarda D-U-N-S conforme decisão do titular. Não há promessa de aprovação automática da Apple ou Google.

M02 preview usa exclusivamente a branch `feat/jenios-mobile-m02-20261024`, projetos QA já aprovados e as mesmas 18 ações externas explicitamente desligadas do G47. A branch de produção permitida permanece `release/jenios-genios-g44-20261024`. A verificação de integridade M02 compara cada arquivo herdado com G47 e cada mudança com seu blob revisado, sem afrouxar as verificações históricas.

Backups anteriores G47 e M01 permanecem imutáveis. Evidências, hashes dos instaladores e o resultado da distribuição serão registrados no checkpoint operacional M02 em outputs após a execução.
