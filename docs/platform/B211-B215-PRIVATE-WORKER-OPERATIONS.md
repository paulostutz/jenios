# JENIOS B211–B215 — preparação operacional privada de leitura Paper

Base certificada: **B210-R2**, commit `c7dda877a83d8929601c39c1def525d3e4baa532`, CI `39522324504` (SUCCESS). Código aditivo para JENIOS Platform. Nenhuma mudança em produção, Social, motor proprietário, Letter, Chefe ou pagamentos.

## Resumo técnico

- **B211 — atestação do adapter privado:** o `--once` existente do B209 agora exige `.mjs` localizado **fora** do repositório, caminho real sem links simbólicos, arquivo pertencente ao usuário (0600), diretório imediato privado (0700), ancestrais não graváveis por terceiros e tamanho limitado. A regra também rejeita hardlinks. Isso protege a etapa de carregamento de código do operador, mas não certifica nem aprova o conteúdo do adapter. Sua revisão independente continua obrigatória.
- **B212 — saúde de auditorias:** um leitor puramente local dos registros B207 classifica ciclos ausentes, expirados, falhos, críticos ou pendentes. Não reinicia auditorias, não altera o SQLite, não envia alertas, não se comunica com corretoras e não libera execução. Um `REVIEW_RECORDED` jamais significa autorização de negociação.
- **B213 — verificação de host:** pré-requisito para executar B209 em Linux/Node.js LTS revisado. Confere as flags READ-ONLY do B206, distinção entre chaves do cofre e do observador, adapter B211, três arquivos SQLite reais e distintos, owner-only, sem symlinks, `PRAGMA integrity_check` e tabelas originais de B152, B178 e B207. Nenhuma base é migrada ou criada pela verificação. O resultado não comprova o serviço instalado, autenticação na corretora ou autorização de ordens.
- **B214 — diagnóstico e exemplo de serviço:** `b214-private-host-check.mjs --check` lê apenas variáveis de ambiente protegidas, sem argumentos de credenciais e sem expor caminhos no resultado. `deploy/private/jenios-paper-observer.service.example` é apenas uma referência systemd de execução manual `Type=oneshot`, sem `[Install]`, `Restart=no`, arquivos privados e restrições de sistema. **Não foi instalado.** O `--once` permanece condicionado ao comprovante HMAC de leitura e adapter revisado.
- **B215 — regressão e integridade:** CI replica a base anterior, testa as novas checagens, build Next, Social e navegador, e rejeita qualquer rota de envio de ordens ou alteração fora da lista de arquivos. Não requer credenciais reais.

## Contrato de host para futura instalação, sujeito à autorização operacional

O administrador deve escolher um host **Linux isolado**, sem compartilhar identidade, projetos, bancos, secrets ou diretórios com Letter/Chefe ou os dados públicos Social. Nenhum servidor/custo foi criado por este bloco.

1. Criar uma conta dedicada, diretório de estado `0700` e três arquivos duráveis existentes `0600`: `risk.sqlite` do B152, `dispatch.sqlite` do B178 e `audit.sqlite` do B207; preparar backup cifrado e recuperação com revisão humana, não reprodução automática de ordens.
2. Disponibilizar o adapter revisado como um arquivo `.mjs` fora do repositório, owner-only `0600`, em pasta `0700`; verificar também ancestrais contra escrita por terceiros. Não colocar identidades, credenciais ou dados reais no GitHub/Biblioteca.
3. Provisionar por gerenciador de segredos `JENIOS_DEMO_VAULT_KEY_B64` e `JENIOS_PAPER_OBSERVER_KEY_B64` diferentes. Nunca emitir esses valores em stdout, chat ou pipeline. Ativar apenas os flags privados de **leitura** B206; `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED`, `JENIOS_PRIVATE_PAPER_EXECUTOR` e `JENIOS_REAL_EXECUTION_ENABLED` permanecem desligados.
4. Configurar `JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH`, `JENIOS_PRIVATE_OBSERVER_RISK_PATH`, `JENIOS_PRIVATE_OBSERVER_DISPATCH_PATH` e `JENIOS_PRIVATE_OBSERVER_AUDIT_PATH` apontando para caminhos locais owner-only. `JENIOS_PRIVATE_PAPER_REHEARSAL`, `JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT`, `JENIOS_PRIVATE_PAPER_READ_OBSERVER` e `JENIOS_PRIVATE_PAPER_OBSERVER_WORKER` devem estar `true` somente no worker privado.
5. Após instalar e revisar a infraestrutura privada, executar `node scripts/platform/connections/b214-private-host-check.mjs --check`. Um resultado de arquivos válidos é **preflight local**, não uma certificação de ligação externa. Só então o operador pode preparar voluntariamente uma conta Alpaca Paper e, com autorização de consulta, usar o B209 `--once` e um comprovante HMAC de curta duração.
6. O exemplo `deploy/private/*.service.example` não tem seção `[Install]` nem timer: nenhum boot, envio ou cron foi configurado. Não copiar/ativar sem aprovação de administrador, backup, supervisão, revisão de caminhos e filtragem de saída de rede.

## Controles financeiros mantidos

A tecnologia conecta a própria conta de corretora do cliente, sem custódia JENIOS. O método de observação permanece **GET** e suporta somente Alpaca Paper. HTTP 404, timeout, desaparecimento de ordens, execução parcial ou corrupção de banco implicam NO_GO e revisão, nunca reenvio. Pausar novas entradas **não** cancela ordens nem encerra posições. Stops não garantem preço ou execução.

O estudo privado B182 foi majoritariamente negativo, sem demonstração de vantagem econômica líquida. Não há validação prospectiva independente, permissão de negociação certificada, homologação externa de corretora ou integração com dinheiro real. Assinaturas e PIX permanecem nos módulos preexistentes, sem novas cobranças neste bloco.

**Pendências objetivas:** provisionar servidor/cofre/armazenamento com aprovação; auditar termos e permissões oficiais do provedor; autenticar voluntariamente uma conta Paper por canal seguro; executar somente consultas aprovadas; registrar recuperação e latências reais; avaliar o núcleo original prospectivamente. Envio de ordens Paper e qualquer dinheiro real exigem **autorizações separadas**, controles operacionais e comprovação externa.
