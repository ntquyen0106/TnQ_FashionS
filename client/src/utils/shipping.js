// --- utils/shipping.js ---

// Bỏ dấu an toàn trên mọi trình duyệt
export const removeDiacritics = (s = '') =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd') // ✅ fix: bắt cả Đ hoa
    .toLowerCase()
    .trim();

// Chuẩn hoá tên địa phương: bỏ "tp", "tinh", "thanh pho", loại dấu -,_
const normalizePlace = (s = '') => {
  const raw = removeDiacritics(s)
    // chuẩn hoá mọi dấu câu thành khoảng trắng (TP.HCM, TPHCM, Ho-Chi-Minh, ...)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // bỏ tiền tố (chấp nhận có/không có khoảng trắng sau "tp."/"tinh"/...)
  return raw.replace(/^(tp|tinh|thanh pho)\s*/, '').trim();
};

const isHcmCity = (city = '') => {
  const c = normalizePlace(city);
  const cNoSpace = c.replace(/\s+/g, '');
  return (
    c === 'hcm' || cNoSpace === 'hcm' || c.includes('ho chi minh') || cNoSpace.includes('hochiminh')
  );
};

// Danh sách vùng (keys đã bỏ dấu, dạng "ba ria vung tau", "da nang", ...)
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

// Utility: kiểm tra city có thuộc set nào (robust: cho phép thiếu/ký tự nối và không dấu cách)
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
  // ✅ ép kiểu số an toàn (hiện không dùng để quyết định ETA)
  const sub = Number(subtotal) || 0;

  // Rule yêu cầu: TP.HCM luôn 0đ ship
  if (isHcmCity(city)) {
    return {
      fee: 0,
      distanceKm: null,
      method: 'region-tier',
      region: 'hcm',
      regionName: 'TP.HCM',
      etaDays: { min: 1, max: 2 },
    };
  }

  const c = normalizePlace(city);

  // Theo vùng (match bằng includes)
  if (isInRegion(c, sets.south))
    return {
      fee: 25000,
      distanceKm: null,
      method: 'region-tier',
      region: 'south',
      regionName: 'Miền Nam',
      etaDays: { min: 1, max: 2 },
    };
  if (isInRegion(c, sets.central))
    return {
      fee: 35000,
      distanceKm: null,
      method: 'region-tier',
      region: 'central',
      regionName: 'Miền Trung',
      etaDays: { min: 3, max: 4 },
    };
  if (isInRegion(c, sets.north))
    return {
      fee: 45000,
      distanceKm: null,
      method: 'region-tier',
      region: 'north',
      regionName: 'Miền Bắc',
      etaDays: { min: 3, max: 4 },
    };

  // Mặc định: vẫn trả về ETA không xác định theo vùng unknown
  return {
    fee: 35000,
    distanceKm: null,
    method: 'region-tier',
    region: 'central',
    regionName: 'Miền Trung',
    etaDays: null,
  };
}

export function computeShippingFee(city = '', district = '', subtotal = 0) {
  return computeShippingDetail(city, district, subtotal).fee;
}

export default computeShippingFee;
