const ensureProtocol = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  const withoutComma = trimmed.split(',')[0].trim();
  if (/^https?:\/\//i.test(withoutComma)) return withoutComma;
  const prefersHttp = /^localhost(\b|:)|^127\.0\.0\.1/.test(withoutComma);
  return `${prefersHttp ? 'http' : 'https'}://${withoutComma}`;
};

const extractCandidates = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toOrigin = (value) => {
  if (!value) return '';
  const normalized = ensureProtocol(value);
  try {
    const url = new URL(normalized);
    return url.origin;
  } catch {
    return normalized;
  }
};

export const getPrimaryClientUrl = () => {
  const raw = process.env.PRIMARY_CLIENT_URL || process.env.CLIENT_URL || '';
  const candidates = extractCandidates(raw);
  const preferred = candidates.find((entry) => !/localhost|127\.0\.0\.1/.test(entry));
  const picked = preferred || candidates[0];
  return toOrigin(picked) || 'http://localhost:5173';
};
