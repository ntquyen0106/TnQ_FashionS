// Vietnam province + ward/commune dataset (effective 01/07/2025)
// Source file is downloaded into this repo as JSON to avoid runtime API/CORS issues.

import raw from './vn-xaphuong-2025.json';

export const removeDiacritics = (s = '') =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim();

const norm = (s = '') => removeDiacritics(String(s)).replace(/\s+/g, ' ').trim();

// Normalize to a lightweight structure used by the UI:
// [{ code, name, wards: [{ code, name }] }]
export const provinces = (Array.isArray(raw) ? raw : [])
  .map((p) => ({
    code: String(p?.matinhTMS ?? p?.matinhBNV ?? ''),
    name: String(p?.tentinhmoi ?? ''),
    wards: Array.isArray(p?.phuongxa)
      ? p.phuongxa
          .map((w) => ({
            code: String(w?.maphuongxa ?? ''),
            name: String(w?.tenphuongxa ?? ''),
          }))
          .filter((w) => w.code && w.name)
      : [],
  }))
  .filter((p) => p.code && p.name)
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export function findProvinceByName(name) {
  if (!name) return undefined;
  const target = norm(name);
  return provinces.find((p) => norm(p.name) === target);
}

export function findWardByName(province, name) {
  if (!province || !name) return undefined;
  const target = norm(name);
  return (province.wards || []).find((w) => norm(w.name) === target);
}
