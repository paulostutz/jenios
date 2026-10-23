# ROBOT-R15 — Multi-window prospective cohort

Escopo: metodologia prospectiva offline para Manual, Híbrido e Reverso. Nenhuma ordem, Paper externo, deploy, serviço pago ou importação do núcleo privado.

## Coorte 01
Ativo: BTC-USD. Seis janelas H1 consecutivas:
- R15-W01: 22/10/2026 21:00–22:00 UTC
- R15-W02: 22/10/2026 22:00–23:00 UTC
- R15-W03: 22/10/2026 23:00–23/10/2026 00:00 UTC
- R15-W04: 23/10/2026 00:00–01:00 UTC
- R15-W05: 23/10/2026 01:00–02:00 UTC
- R15-W06: 23/10/2026 02:00–03:00 UTC

Cada janela exige registro anterior em pelo menos 10 minutos. As seis combinações de modo/intenção podem ser classificadas apenas como ABSTAIN ou PREVIEW. PREVIEW exige side buy/sell. Resultado pós-candle só pode ser ligado ao SHA-256 exato do pré-registro daquela janela.

O agregador reporta contagens de previews/abstenções e consistência de evidência pública. P&L real, perdas evitadas e taxa de acerto permanecem null sem fills reais e contrafactual observável.
