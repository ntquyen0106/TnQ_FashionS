import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productsApi } from '@/api/products-api';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const img = (publicId, w = 900) =>
  publicId && CLOUD
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${publicId}`
    : '/no-image.png';

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState(null);

  useEffect(() => {
    productsApi.detailBySlug(slug).then(setP);
  }, [slug]);

  if (!p)
    return (
      <div className="container" style={{ padding: '24px 0' }}>
        Đang tải…
      </div>
    );

  const price = p.variants?.length
    ? Math.min(...p.variants.map((v) => Number(v?.price ?? NaN)))
    : undefined;

  const cover = p.images?.find?.((im) => im?.isPrimary)?.publicId || p.images?.[0]?.publicId;

  return (
    <div className="container" style={{ padding: '24px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#f7f7f7', borderRadius: 12, overflow: 'hidden' }}>
          <img
            src={img(cover)}
            alt={p.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div>
          <h1 style={{ marginTop: 0 }}>{p.name}</h1>
          <div style={{ fontWeight: 700, fontSize: 20, margin: '8px 0' }}>
            {Number.isFinite(price)
              ? new Intl.NumberFormat('vi-VN').format(price) + ' VND'
              : 'Liên hệ'}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
        </div>
      </div>
    </div>
  );
}
