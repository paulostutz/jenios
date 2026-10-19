# JENIOS B110 — Aplicação da identidade visual aprovada

Base Production B95, commit 72e4a27bdc851937ea6ce72682c0489d975b6e2d.
Backup anterior: backup/jenios-b95-before-new-brand-20261019.
Branch: fix/jenios-b110-brand-signature-favicon-20261019.

A marca nova usa o J em azul, ciano e verde e o logotipo horizontal JENIOS gerado e aprovado.
As imagens são apenas recortadas e redimensionadas da arte aprovada, sem redesenhar o símbolo.
Favicon ICO, Next icon PNG e Apple touch icon PNG compartilham o mesmo J.
LP, Social, Dashboard, Mesa, Sala de Controle, Admin e Portal reutilizam o componente BrandSignature.
Em fundos claros, a logo horizontal original; em fundos escuros, símbolo J e letras claras.
Rodapés discretos, sem alteração dos slogans oficiais de cada produto.
Zero alterações em autorização, usuários, posts, relatórios, pagamentos, APIs e núcleos dos robôs.
Deploy somente após CI, build, smoke e rollback. Favicon pode exigir limpeza do cache.