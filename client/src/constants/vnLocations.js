// Lightweight Vietnam locations dataset (pre-merger names for key cities)
// Note: This is a minimal seed. Extend as needed with more provinces/districts/wards.

export const provinces = [
  {
    code: '79',
    name: 'TP. Hồ Chí Minh',
    districts: [
      {
        code: '760',
        name: 'Quận 1',
        wards: [
          { code: '26734', name: 'Phường Bến Nghé' },
          { code: '26737', name: 'Phường Bến Thành' },
          { code: '26740', name: 'Phường Nguyễn Thái Bình' },
          { code: '26743', name: 'Phường Phạm Ngũ Lão' },
          { code: '26746', name: 'Phường Cầu Ông Lãnh' },
        ],
      },
      {
        code: '761',
        name: 'Quận 12',
        wards: [
          { code: '26749', name: 'Phường Thạnh Xuân' },
          { code: '26752', name: 'Phường Thạnh Lộc' },
          { code: '26755', name: 'Phường Hiệp Thành' },
        ],
      },
      // Pre-merger districts
      {
        code: '772',
        name: 'Quận 2',
        wards: [
          { code: '27049', name: 'Phường Thảo Điền' },
          { code: '27052', name: 'Phường An Phú' },
          { code: '27055', name: 'Phường Bình An' },
        ],
      },
      {
        code: '774',
        name: 'Quận 9',
        wards: [
          { code: '27091', name: 'Phường Phước Long A' },
          { code: '27094', name: 'Phường Phước Long B' },
          { code: '27097', name: 'Phường Tăng Nhơn Phú A' },
        ],
      },
      {
        code: '765',
        name: 'Quận Thủ Đức',
        wards: [
          { code: '26830', name: 'Phường Linh Tây' },
          { code: '26833', name: 'Phường Linh Trung' },
          { code: '26836', name: 'Phường Linh Chiểu' },
        ],
      },
      {
        code: '764',
        name: 'Quận Gò Vấp',
        wards: [
          { code: '26785', name: 'Phường 01' },
          { code: '26788', name: 'Phường 03' },
          { code: '26791', name: 'Phường 04' },
        ],
      },
      {
        code: '770',
        name: 'Quận 7',
        wards: [
          { code: '26920', name: 'Phường Tân Phú' },
          { code: '26923', name: 'Phường Tân Quy' },
          { code: '26926', name: 'Phường Tân Kiểng' },
        ],
      },
    ],
  },
  {
    code: '01',
    name: 'Hà Nội',
    districts: [
      {
        code: '001',
        name: 'Quận Ba Đình',
        wards: [
          { code: '00001', name: 'Phường Phúc Xá' },
          { code: '00004', name: 'Phường Trúc Bạch' },
          { code: '00006', name: 'Phường Vĩnh Phúc' },
        ],
      },
      {
        code: '002',
        name: 'Quận Hoàn Kiếm',
        wards: [
          { code: '00009', name: 'Phường Chương Dương' },
          { code: '00012', name: 'Phường Hàng Buồm' },
          { code: '00015', name: 'Phường Hàng Bạc' },
        ],
      },
      {
        code: '008',
        name: 'Quận Hai Bà Trưng',
        wards: [
          { code: '00169', name: 'Phường Bạch Đằng' },
          { code: '00172', name: 'Phường Bùi Thị Xuân' },
          { code: '00175', name: 'Phường Lê Đại Hành' },
        ],
      },
    ],
  },
  {
    code: '48',
    name: 'Đà Nẵng',
    districts: [
      {
        code: '490',
        name: 'Quận Hải Châu',
        wards: [
          { code: '20194', name: 'Phường Hải Châu I' },
          { code: '20197', name: 'Phường Hải Châu II' },
          { code: '20200', name: 'Phường Thạch Thang' },
        ],
      },
      {
        code: '495',
        name: 'Quận Sơn Trà',
        wards: [
          { code: '20227', name: 'Phường An Hải Đông' },
          { code: '20230', name: 'Phường An Hải Tây' },
          { code: '20233', name: 'Phường An Hải Bắc' },
        ],
      },
    ],
  },
];

export function findProvinceByName(name) {
  if (!name) return undefined;
  const norm = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const target = norm(name);
  return provinces.find((p) => norm(p.name) === target);
}

export function findDistrictByName(province, name) {
  if (!province || !name) return undefined;
  const norm = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const target = norm(name);
  return province.districts.find((d) => norm(d.name) === target);
}

export function findWardByName(district, name) {
  if (!district || !name) return undefined;
  const norm = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const target = norm(name);
  return district.wards.find((w) => norm(w.name) === target);
}
