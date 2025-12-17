// server/src/utils/shipping.js

// Remove diacritics safely
export const removeDiacritics = (s = '') =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizePlace = (s = '') => {
  const x = removeDiacritics(s)
    .replace(/^(tp|tinh|thanh pho)\.?\s+/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return x;
};

// Đơn giản: chỉ phân chia theo miền (South/Central/North)

const sets = {
  remote: new Set(
    [
      'ha giang',
      'cao bang',
      'bac kan',
      'tuyen quang',
      'yen bai',
      'lao cai',
      'lai chau',
      'dien bien',
      'son la',
      'kon tum',
      'gia lai',
      'dak lak',
      'dak nong',
      'lam dong',
    ].map(removeDiacritics),
  ),
  south: new Set(
    [
      'ho chi minh',
      'binh duong',
      'dong nai',
      'ba ria vung tau',
      'tay ninh',
      'long an',
      'tien giang',
      'vinh long',
      'ben tre',
      'tra vinh',
      'dong thap',
      'an giang',
      'kien giang',
      'hau giang',
      'soc trang',
      'bac lieu',
      'ca mau',
      'binh phuoc',
      'can tho',
    ].map(removeDiacritics),
  ),
  central: new Set(
    [
      'da nang',
      'quang nam',
      'quang ngai',
      'binh dinh',
      'phu yen',
      'khanh hoa',
      'ninh thuan',
      'binh thuan',
      'thua thien hue',
      'quang tri',
      'quang binh',
    ].map(removeDiacritics),
  ),
  north: new Set(
    [
      'ha noi',
      'hai phong',
      'quang ninh',
      'bac ninh',
      'hung yen',
      'ha nam',
      'nam dinh',
      'thai binh',
      'ninh binh',
      'vinh phuc',
      'bac giang',
      'phu tho',
      'thai nguyen',
      'hoa binh',
      'hai duong',
      'nghe an',
      'thanh hoa',
    ].map(removeDiacritics),
  ),
};

const isInRegion = (cityRaw, regionSet) => {
  const c = normalizePlace(cityRaw);
  for (const name of regionSet) {
    if (c.includes(name)) return true;
  }
  return false;
};

export function computeShippingDetail(city = '', district = '', subtotal = 0) {
  const sub = Number(subtotal) || 0;
  if (sub <= 0) return { fee: 0, method: 'none' };

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
