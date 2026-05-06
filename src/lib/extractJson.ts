export function extractJson(text: string): Record<string, unknown> {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const p = JSON.parse(s);
      if (p && typeof p === "object" && !Array.isArray(p)) return p;
    } catch {}
    return null;
  };

  const clean = text.trim();
  const direct = tryParse(clean);
  if (direct) return direct;

  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { const r = tryParse(fenced[1].trim()); if (r) return r; }

  const obj = clean.match(/\{[\s\S]*\}/);
  if (obj) { const r = tryParse(obj[0]); if (r) return r; }

  return {};
}
