import { getApiOrigin } from './apiBase';

const API_ORIGIN = getApiOrigin();

const qs = (obj = {}) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

export async function getCategories(params = {}) {
  const url = `${API_ORIGIN}/api/categories?${qs(params)}`;
  const res = await fetch(url, { credentials: 'include' }); // nếu backend dùng cookie
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
export async function getChildren(params = {}) {
  const url = `${API_ORIGIN}/api/categories/children?${qs(params)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

export async function getBreadcrumb(params = {}) {
  const url = `${API_ORIGIN}/api/categories/breadcrumb?${qs(params)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
// Thêm danh mục
export async function createCategory(data) {
  const url = `${API_ORIGIN}/api/categories`;
  const payload = {
    ...data,
    parentId: data.parentId || null,
    sort: Number(data.sort ?? 0),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json();
}

// Sửa danh mục
export async function updateCategory(id, data) {
  const url = `${API_ORIGIN}/api/categories/${id}`;
  const payload = {
    ...data,
    parentId: data.parentId === '' ? null : data.parentId,
    sort: Number(data.sort ?? 0),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PUT ${url} -> ${res.status}`);
  return res.json();
}

// Xóa danh mục
export async function deleteCategory(id) {
  const url = `${API_ORIGIN}/api/categories/${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`DELETE ${url} -> ${res.status}`);
  return res.json();
}
