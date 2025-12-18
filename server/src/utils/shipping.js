// server/src/utils/shipping.js

// Remove diacritics safely
export const removeDiacritics = (s = '') =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd') // ✅ fix
    .toLowerCase()
    .trim();

const normalizePlace = (s = '') => {
  const raw = removeDiacritics(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return raw.replace(/^(tp|tinh|thanh pho)\s*/, '').trim();
};

const isHcmCity = (city = '') => {
  const c = normalizePlace(city);
  const cNoSpace = c.replace(/\s+/g, '');
  return (
    c === 'hcm' || cNoSpace === 'hcm' || c.includes('ho chi minh') || cNoSpace.includes('hochiminh')
  );
};

// Đơn giản: chỉ phân chia theo miền (South/Central/North)

const sets = {
  south: new Set(
    [
      'dong nai',
      'tay ninh',
      'vinh long',
      'dong thap',
      'an giang',
      'ca mau',
      'can tho',
      // TP.HCM được xử lý riêng (0đ)
      'ho chi minh',
    ].map(removeDiacritics),
  ),
  central: new Set(
    [
      'thanh hoa',
      'nghe an',
      'ha tinh',
      'quang tri',
      'hue',
      'da nang',
      'quang ngai',
      'gia lai',
      'dak lak',
      'khanh hoa',
      'lam dong',
    ].map(removeDiacritics),
  ),
  north: new Set(
    [
      'ha noi',
      'thai nguyen',
      'tuyen quang',
      'lao cai',
      'phu tho',
      'bac ninh',
      'hung yen',
      'hai phong',
      'ninh binh',
      'lai chau',
      'dien bien',
      'son la',
      'lang son',
      'quang ninh',
      'cao bang',
    ].map(removeDiacritics),
  ),
};

const isInRegion = (cityRaw, regionSet) => {
  const c = normalizePlace(cityRaw);
  const cNoSpace = c.replace(/\s+/g, '');
  for (const name of regionSet) {
    if (c.includes(name)) return true;
    const nameNoSpace = String(name).replace(/\s+/g, '');
    if (cNoSpace.includes(nameNoSpace)) return true;
  }
  return false;
};

export function computeShippingDetail(city = '', district = '', subtotal = 0) {
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return { fee: 0, method: 'none' };

  // Rule yêu cầu: TP.HCM luôn 0đ ship
  if (isHcmCity(city)) return { fee: 0, method: 'region' };

  const c = normalizePlace(city);

  // Miền Nam: 25k
  if (isInRegion(c, sets.south)) return { fee: 25000, method: 'region' };

  // Miền Trung: 35k
  if (isInRegion(c, sets.central)) return { fee: 35000, method: 'region' };

  // Miền Bắc: 45k
  if (isInRegion(c, sets.north)) return { fee: 45000, method: 'region' };

  // Mặc định: 35k
  return { fee: 35000, method: 'region' };
}

export function computeShippingFee(city = '', district = '', subtotal = 0) {
  return computeShippingDetail(city, district, subtotal).fee;
}

export default computeShippingFee;
