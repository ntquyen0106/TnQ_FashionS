export function formatCurrency(v, currency = 'VND', locale = 'vi-VN') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(v || 0));
  } catch {
    return `${(v || 0).toLocaleString('vi-VN')} đ`;
  }
}
export const formatNumber = (v, locale = 'vi-VN') => Number(v || 0).toLocaleString(locale);
export const formatDate = (d, locale = 'vi-VN', opts) =>
  (d instanceof Date ? d : new Date(d)).toLocaleString(locale, opts || { hour12: false });
export const maskPhone = (p) =>
  !p
    ? ''
    : String(p)
        .replace(/\D/g, '')
        .replace(/^(\d{3})\d+(\d{3})$/, '$1 **** $2');
