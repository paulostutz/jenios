export function prepararRanking(registros, periodo, limite = 10) {
  if (!Array.isArray(registros) || !Number.isInteger(limite) || limite < 1) throw new TypeError('INVALID_RANKING_INPUT');
  const elegiveis = registros.map((r) => {
    const bruto = r.indice_basileia_bruto == null ? NaN : Number(r.indice_basileia_bruto);
    const percentual = r.indice_basileia_percentual_provisorio == null ? NaN : Number(r.indice_basileia_percentual_provisorio);
    return { codigo: String(r.codigo_instituicao ?? '').trim(), nome: String(r.nome_instituicao ?? '').trim(), periodo: r.periodo, tipo: r.tipo_instituicao, percentual, bruto };
  }).filter(r => r.codigo && r.nome && Number(r.periodo) === Number(periodo) && Number.isFinite(r.bruto) && r.bruto >= 0 && r.bruto <= 1 && Number.isFinite(r.percentual) && r.percentual >= 0 && r.percentual <= 100 && Math.abs(r.percentual - r.bruto * 100) <= 0.01);
  elegiveis.sort((a,b) => b.percentual - a.percentual || a.nome.localeCompare(b.nome,'pt-BR'));
  const vistos = new Set();
  const unicos = elegiveis.filter(r => { if (vistos.has(r.codigo)) return false; vistos.add(r.codigo); return true; });
  return { ranking: unicos.slice(0, limite), elegiveis: unicos.length, universo: registros.length, periodo, aviso: 'Indicadores provisórios de homologação; não constituem ranking de segurança, rating ou recomendação.' };
}

export async function lerTodasPaginas(consultar, { lote = 500, maximo = 10000 } = {}) {
  if (!Number.isInteger(lote) || lote < 1 || !Number.isInteger(maximo) || maximo < 1) throw new TypeError('INVALID_PAGINATION');
  const registros = [];
  while (registros.length < maximo) {
    const tamanho = Math.min(lote, maximo - registros.length);
    const pagina = await consultar(registros.length, registros.length + tamanho - 1);
    if (!Array.isArray(pagina) || pagina.length > tamanho) throw new TypeError('INVALID_PAGE');
    registros.push(...pagina);
    if (pagina.length < tamanho) return registros;
  }
  // One-record probe: exact limit is complete only when no additional row exists.
  const extra = await consultar(maximo, maximo);
  if (!Array.isArray(extra) || extra.length > 1) throw new TypeError('INVALID_PAGE');
  if (extra.length) throw new Error('RANKING_INCOMPLETO');
  return registros;
}
