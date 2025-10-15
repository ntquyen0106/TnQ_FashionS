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

// Shop location (900 Nguyen Kiem, P3, Go Vap, HCMC). Configure via env for precision.
const ENV_LAT = Number(process.env.SHOP_LAT);
const ENV_LNG = Number(process.env.SHOP_LNG);
const SHOP_COORD =
  !Number.isNaN(ENV_LAT) && !Number.isNaN(ENV_LNG)
    ? { lat: ENV_LAT, lng: ENV_LNG }
    : { lat: 10.816, lng: 106.677 };

const HCMC_DISTRICT_CENTROIDS = {
  'quan 1': { lat: 10.775, lng: 106.7 },
  'quan 3': { lat: 10.787, lng: 106.682 },
  'quan 4': { lat: 10.764, lng: 106.707 },
  'quan 5': { lat: 10.755, lng: 106.667 },
  'quan 6': { lat: 10.748, lng: 106.635 },
  'quan 7': { lat: 10.737, lng: 106.722 },
  'quan 8': { lat: 10.727, lng: 106.63 },
  'quan 10': { lat: 10.773, lng: 106.666 },
  'quan 11': { lat: 10.762, lng: 106.65 },
  'quan 12': { lat: 10.867, lng: 106.64 },
  'binh thanh': { lat: 10.804, lng: 106.713 },
  'phu nhuan': { lat: 10.795, lng: 106.68 },
  'go vap': { lat: 10.838, lng: 106.672 },
  'tan binh': { lat: 10.802, lng: 106.652 },
  'tan phu': { lat: 10.786, lng: 106.628 },
  'binh tan': { lat: 10.769, lng: 106.603 },
  'thu duc': { lat: 10.87, lng: 106.76 },
  'nha be': { lat: 10.695, lng: 106.74 },
  'binh chanh': { lat: 10.706, lng: 106.553 },
  'hoc mon': { lat: 10.892, lng: 106.59 },
  'cu chi': { lat: 11.023, lng: 106.495 },
  'can gio': { lat: 10.411, lng: 106.954 },
};

const toRad = (d) => (d * Math.PI) / 180;
const haversineKm = (a, b) => {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

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
  if (sub <= 0) return { fee: 0, distanceKm: null, method: 'none' };

  const c = normalizePlace(city);
  const isHcm = c === 'hcm' || c.includes('ho chi minh');
  if (isHcm) {
    const d = normalizePlace(district || '');
    const dest = HCMC_DISTRICT_CENTROIDS[d] || { lat: 10.776, lng: 106.7 };
    const distanceKm = haversineKm(SHOP_COORD, dest);
    if (distanceKm <= 15) {
      return { fee: 0, distanceKm: Number(distanceKm.toFixed(1)), method: 'hcm-distance' };
    }
    const extra = Math.ceil(distanceKm - 15);
    const fee = 30000 + 2000 * extra;
    return { fee, distanceKm: Number(distanceKm.toFixed(1)), method: 'hcm-distance' };
  }

  if (isInRegion(c, sets.remote)) return { fee: 45000, distanceKm: null, method: 'region-tier' };
  if (isInRegion(c, sets.south)) return { fee: 25000, distanceKm: null, method: 'region-tier' };
  if (isInRegion(c, sets.central)) return { fee: 30000, distanceKm: null, method: 'region-tier' };
  if (isInRegion(c, sets.north)) return { fee: 35000, distanceKm: null, method: 'region-tier' };

  return { fee: 30000, distanceKm: null, method: 'region-tier' };
}

export function computeShippingFee(city = '', district = '', subtotal = 0) {
  return computeShippingDetail(city, district, subtotal).fee;
}

export default computeShippingFee;
