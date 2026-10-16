# JENIOS R30 — identidade separada e LP sem mascotes

Data: 16/10/2026. Escopo JENIOS. **Decisão posterior do proprietário prevalece:** os mascotes humanos Gênio e Gênia NÃO devem ser exibidos na landing page, no portal público ou como cards/hero da LP. Os dois personagens ficam em rascunhos de posts e no suporte interno da Platform logada. A preferência do atendente permanece estável para o usuário.

## Identidades
- Platform: “A Plataforma Que Transforma o Seu Erro Em Lucro”.
- Social: slogan próprio, texto literal não recuperado com segurança; não inventar e não aplicar o da Platform.
- LP: layout/cores/copy preservados, apenas slogan institucional como texto, nenhuma imagem dos mascotes.
- Postagens: seis rascunhos autorais Platform com alternância determinística Gênio/Gênia e três ideias da Social aguardando seu slogan; não há envio automático.
- Suporte: o módulo /platform/assistente conserva escolha masculina/feminina e avatares anteriores. Não introduzir personagens na LP.
- T.Jenio preservado nesta correção pontual para não apagar progresso ou mudar o produto educacional de forma colateral.

## Verificação local
- 538 testes da aplicação aprovados, zero falhas/ignorados.
- 108 testes preservados do núcleo privado aprovados novamente.
- Sintaxe de 324 arquivos verificada.
- Build Next.js/webpack concluído com sucesso.
- HTML prerenderizado /lp.html inspecionado: sem caminhos dos mascotes e sem PlatformBrandMoment; slogan da Platform presente.
- Comparação contra o ZIP R29: **144 arquivos sensíveis de Social/APIs financeiras idênticos byte a byte**; os únicos fontes preexistentes alterados foram app/page.js e app/lp/page.js. Componentes temporários da R30 que exibiam mascotes na LP foram excluídos ANTES da entrega.
- Navegação de navegador, autenticação real e publicação Vercel não foram homologadas nesta revisão.
- Nenhum dado, cobrança, conta, integração, ordem real ou produção foi modificado.

## Backup privado
- Salvo na Biblioteca como /JENIOS-Platform-R30-completo-privado.zip
- Arquivo ZIP: 6.121.743 bytes; 614 arquivos.
- SHA-256: 194d421b8a408c2cf3e77c0652c33f2bc011b517ae02d1ec40b24bce4d7fe1d1
- Manifesto de todos os arquivos e evidências de regressão incluídos.
- É uma entrega cumulativa R25–R30; mantém núcleo proprietário separado e não publicado em GitHub público.
- Código ainda NÃO aplicado à main ou à Vercel. Main conhecida em 8bcdef507ee2774bc24f832e1d04608fde16aea9 (R24). Branch de checkpoint contém documentação, não a aplicação privada.

A versão anterior da Social e os serviços BankScore, Validador, PDFs e PAY continuam preservados.