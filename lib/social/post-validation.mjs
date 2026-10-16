// Validate metadata before writing a social post. Uploaded assets must be referenced by URL.
export function validatePostPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "INVALID_POST";
  const { body = "", media = [] } = payload;
  if (typeof body !== "string" || body.length > 10000 || !Array.isArray(media) || media.length > 10) return "INVALID_POST";
  if (!body.trim() && media.length === 0) return "EMPTY_POST";
  for (const item of media) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "INVALID_MEDIA";
    const url = item.url || item.src;
    if (typeof url !== "string" || url.length > 2048) return "INVALID_MEDIA";
    let parsed;
    try { parsed = new URL(url); } catch { return "INVALID_MEDIA"; }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "INVALID_MEDIA";
    if (item.type != null && !["image", "video"].includes(item.type)) return "INVALID_MEDIA";
    if (JSON.stringify(item).length > 2500) return "INVALID_MEDIA";
  }
  return null;
}
