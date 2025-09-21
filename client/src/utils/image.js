const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
export function imgUrl(publicId, { w, h, crop } = {}) {
  const t = ['f_auto', 'q_auto'];
  if (w) t.push(`w_${w}`);
  if (h) t.push(`h_${h}`);
  if (crop) t.push(`c_${crop}`);
  return `https://res.cloudinary.com/${cloud}/image/upload/${t.join(',')}/${publicId}`;
}
