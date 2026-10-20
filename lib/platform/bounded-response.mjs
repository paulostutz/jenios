/** Size-limited JSON transport. Only use for server-side requests/responses. */
export async function readBoundedJson(message, maxBytes = 65536) {
  const invalid = () => Object.assign(new Error('Resposta JSON inválida ou acima do limite.'), {status:502, code:'BOUNDED_JSON_INVALID'});
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw invalid();
  const length = message.headers?.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    void message.body?.cancel().catch(() => {}); throw invalid();
  }
  const reader = message.body?.getReader(); if (!reader) throw invalid();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { void reader.cancel().catch(() => {}); throw invalid(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { all.set(chunk,offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(all)); }
  catch { throw invalid(); }
}

/** An incomplete/refused/malformed envelope is NOT a successful assistant reply. */
export function completedModelText(raw) {
  if (!raw || raw.status !== 'completed' || !Array.isArray(raw.output)) return null;
  const texts = [];
  for (const item of raw.output) {
    if (!item || typeof item !== 'object') return null;
    if (item.type !== 'message') continue;
    if (item.status && item.status !== 'completed') return null;
    if (!Array.isArray(item.content)) return null;
    for (const part of item.content) {
      if (!part || part.type === 'refusal') return null;
      if (part.type === 'output_text') {
        if (typeof part.text !== 'string') return null;
        texts.push(part.text);
      }
    }
  }
  return texts.length ? texts.join('') : null;
}