const qs = (obj = {}) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function getCategories(params = {}) {
  const url = `${API_BASE}/api/categories?${qs(params)}`;
  const res = await fetch(url, { credentials: 'include' }); // nếu backend dùng cookie
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
export async function getChildren(params = {}) {
  const res = await fetch(`/api/categories/children?${qs(params)}`);
  if (!res.ok) throw new Error('Failed to fetch children');
  return res.json();
}

export async function getBreadcrumb(params = {}) {
  const res = await fetch(`/api/categories/breadcrumb?${qs(params)}`);
  if (!res.ok) throw new Error('Failed to fetch breadcrumb');
  return res.json();
}
