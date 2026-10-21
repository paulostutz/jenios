# JENIOS — B276: Universidade homologação isolada
Data: 21/10/2026. Pai congelado B275 `eabf9eab376bd201186ee339404563976063a92a`.
Somente artefatos de teste e CI. Nenhum módulo funcional, contrato, conta ou preço alterado.
## Critérios de aceite
- Matrícula autorizada pelo serviço de aprendizagem e distinção da negativa 402 quando não há direito de acesso.
- Cinco trilhas/15 aulas sem nivelamento, nota ou requisito anterior; ordem livre e modo avançado como primeira aula.
- Dez oficinas opcionais, com 2 por trilha; 56 referências preservadas, sendo 36 ainda sem revisão.
- Persistência fictícia após novo GET; conflitos 409; isolamento entre contas; histórico anterior de provas, notas, progresso e revisão preservado.
- Proteção do acesso: nenhum dado privado para visitante.
- Navegador em localhost: páginas da Universidade e sala sem autenticação em 1440, 768, 390, 320 e 844 pixels, sem rolagem horizontal; nenhum pedido de pagamento ou envio de ordem; smoke anterior de login/cadastro e regras de acesso financeiro.
- CI integral npm run build; validação do código fonte protegido; screenshots e contas reais fora de escopo.
## Limitações explícitas
Os testes de estado autenticado utilizam adaptadores locais com identidades sintéticas e armazenamento em memória. Não constituem homologação ponta-a-ponta contra um tenant Supabase real.
O navegador verifica o caminho de visitante, responsividade e controles de acesso sem autenticação; a compra Pix fica inativa.
Somente CI verde e revisão de evidências podem certificar o código desta homologação; nenhum deploy autorizado.
