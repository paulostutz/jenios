export function avaliarIndicador(row) {
  const bruto = row?.indice_basileia_bruto == null ? NaN : Number(row.indice_basileia_bruto);
  const pct = row?.indice_basileia_percentual_provisorio == null ? NaN : Number(row.indice_basileia_percentual_provisorio);
  const consistente = Number.isFinite(bruto) && Number.isFinite(pct) && Math.abs(bruto * 100 - pct) <= 0.01;
  const valido = consistente && pct >= 0 && pct <= 100;
  return {
    percentual: Number.isFinite(pct) ? pct : null,
    revisao: !consistente ? 'INDICADOR_INCONSISTENTE' : !valido ? 'INDICADOR_FORA_FAIXA' : 'PROVISORIO',
    valido
  };
}
export function periodoValido(valor) {
  if (typeof valor !== 'string' || !/^\d{6}$/.test(valor)) return false;
  const mes = Number(valor.slice(4));
  return mes >= 1 && mes <= 12;
}
