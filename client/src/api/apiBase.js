export function getApiOrigin() {
  const configured = import.meta.env.VITE_API_URL;

  // Dev: default to local server unless overridden.
  if (!import.meta.env.PROD) {
    return configured || 'http://localhost:5000';
  }

  // Prod: prefer same-origin to avoid iOS Safari blocking cross-site cookies (ITP).
  // Vercel will proxy /api/* to the real backend via vercel.json routes.
  if (typeof window === 'undefined') {
    return configured || '';
  }

  if (!configured) return '';

  try {
    const cfg = new URL(configured);
    if (cfg.origin === window.location.origin) return configured;
    return '';
  } catch {
    // If it's not a valid absolute URL, treat it as a relative base.
    return configured;
  }
}

export function getApiBase() {
  return `${getApiOrigin()}/api`;
}
