import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '@/api/products-api';
import { toast } from 'react-hot-toast';
import styles from './ProductDetail.module.css';
import { useCart } from '@/contexts/CartProvider';
import { showAddToCartToast } from '@/components/showAddToCartToast';
import { promotionsApi } from '@/api/promotions-api';
import ReviewSection from '@/components/ReviewSection';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
// Encode each path segment so publicId có dấu/khoảng trắng vẫn hiển thị đúng
const encodePublicId = (pid) => (pid ? pid.split('/').map(encodeURIComponent).join('/') : '');
const img = (publicId, w = 900) =>
  publicId && CLOUD
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${encodePublicId(
        publicId,
      )}`
    : '/no-image.png';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add, refresh } = useCart();

  const [p, setP] = useState(null);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [activeImg, setActiveImg] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(null);
  const lastColorRef = useRef(null);
  const [promos, setPromos] = useState([]);
  const [soldQty, setSoldQty] = useState(0);

  // đặt gần đầu file
  // chuẩn hoá bỏ dấu để so khớp màu với alt/publicId bất kể dấu
  const norm = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const pickImageForColor = (product, color, variant) => {
    const images = product?.images || [];
    const key = norm(color);

    // 1) ưu tiên ảnh trong gallery theo alt khớp màu (bỏ dấu)
    const byAlt = images.find((im) => norm(im?.alt).includes(key));
    if (byAlt?.publicId) return byAlt.publicId;

    // 2) thử khớp theo publicId (trường hợp alt không thiết lập đúng)
    const byId = images.find((im) => norm(im?.publicId).includes(key));
    if (byId?.publicId) return byId.publicId;

    // 3) nếu variant có imagePublicId và cũng có trong gallery -> dùng
    if (variant?.imagePublicId) {
      const inGallery = images.some((im) => im?.publicId === variant.imagePublicId);
      if (inGallery) return variant.imagePublicId;
    }

    // 4) fallback: ảnh primary hoặc ảnh đầu
    return images.find((im) => im?.isPrimary)?.publicId || images[0]?.publicId || null;
  };

  const totalStock = useMemo(() => {
    if (Array.isArray(p?.variants) && p.variants.length) {
      return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    }
    // fallback nếu bạn có product.stock ở 1 số SP đơn
    return Number(p?.stock || 0);
  }, [p]);

  const currentStock = useMemo(() => {
    // ưu tiên tồn kho của biến thể đang chọn nếu có
    if (variant && typeof variant.stock !== 'undefined') {
      return Number(variant.stock) || 0;
    }
    return totalStock;
  }, [variant, totalStock]);

  useEffect(() => {
    // Khi đổi biến thể, reset qty về 1 và không vượt quá tồn kho
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, currentStock || 1)));
  }, [variant, currentStock]);

  // Lấy chi tiết sản phẩm
  useEffect(() => {
    productsApi.detailBySlug(slug).then((data) => {
      setP(data);
      const coverId =
        data?.images?.find?.((im) => im?.isPrimary)?.publicId ||
        data?.images?.[0]?.publicId ||
        null;
      setActiveImg(coverId);

      const first = data?.variants?.[0];
      if (first) {
        setVariant(first);
        setColor(first.color || null);
        setSize(first.size || null);
        const pid = pickImageForColor(data, first.color, first);
        setActiveImg(pid);
        lastColorRef.current = first.color || null;
      }
    });
  }, [slug]);

  // Lấy khuyến mãi áp dụng cho sản phẩm (bỏ qua điều kiện đơn tối thiểu)
  useEffect(() => {
    if (!p?._id) return;
    let alive = true;
    (async () => {
      try {
        const data = await promotionsApi.available(0, { all: true, productIds: [p._id] });
        const applicable = (data || []).filter((x) => x.applicable);
        if (alive) setPromos(applicable);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [p?._id]);

  // Fetch sold qty for product
  useEffect(() => {
    if (!p?._id) return;
    let alive = true;
    (async () => {
      try {
        const res = await productsApi.salesCount([p._id]);
        const counts = res?.counts || {};
        if (alive) setSoldQty(Number(counts[p._id] || 0));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [p?._id]);

  // Mảng màu
  const colors = useMemo(() => {
    const set = new Set((p?.variants || []).map((v) => v.color).filter(Boolean));
    return Array.from(set);
  }, [p]);

  // Mảng size theo màu
  const sizesForColor = useMemo(() => {
    const list = (p?.variants || []).filter((v) => !color || v.color === color);
    const set = new Set(list.map((v) => v.size).filter(Boolean));
    return Array.from(set);
  }, [p, color]);

  // Khi đổi màu/size -> chọn đúng variant
  useEffect(() => {
    if (!p?.variants?.length) return;

    // chọn variant khớp (color, size) hoặc fallback
    let found =
      p.variants.find((v) => (!color || v.color === color) && (!size || v.size === size)) ||
      p.variants[0];

    // nếu size hiện tại không hợp lệ cho màu mới -> pick size đầu của màu đó
    if (!found && color) {
      const firstOfColor = p.variants.find((v) => v.color === color);
      if (firstOfColor) {
        setSize(firstOfColor.size || null);
        found = firstOfColor;
      }
    }

    setVariant(found);

    // chỉ đổi ảnh khi MÀU thay đổi
    if (color !== lastColorRef.current) {
      const pid = pickImageForColor(p, color, found);
      if (pid) setActiveImg(pid);
      lastColorRef.current = color;
    }
  }, [color, size, p]);

  const price = useMemo(() => {
    if (variant?.price) return variant.price;
    if (p?.variants?.length) {
      const min = Math.min(...p.variants.map((v) => Number(v?.price ?? Infinity)));
      return Number.isFinite(min) ? min : undefined;
    }
    return p?.price;
  }, [p, variant]);

  // Calculate maximum discount from all applicable promotions
  const { finalPrice, discountPercent, discountAmount, hasDiscount, bestPromo, isPercentPromo } =
    useMemo(() => {
      if (!Number.isFinite(price) || !promos.length) {
        return {
          finalPrice: price,
          discountPercent: 0,
          discountAmount: 0,
          hasDiscount: false,
          bestPromo: null,
        };
      }

      // Find the promotion that gives maximum discount
      let maxDiscount = 0;
      let maxDiscountPercent = 0;
      let bestPromotion = null;
      let isPercentPromo = false;

      for (const promo of promos) {
        let discount = 0;
        let percentValue = 0;

        if (promo.type === 'percent') {
          discount = Math.round(price * (promo.value / 100));
          percentValue = promo.value;

          if (discount > maxDiscount) {
            maxDiscount = discount;
            maxDiscountPercent = percentValue;
            bestPromotion = promo;
            isPercentPromo = true;
          }
        } else if (promo.type === 'amount') {
          discount = promo.value;

          if (discount > maxDiscount) {
            maxDiscount = discount;
            maxDiscountPercent = 0; // Don't show % for amount type
            bestPromotion = promo;
            isPercentPromo = false;
          }
        }
      }

      return {
        finalPrice: Math.max(0, price - maxDiscount),
        discountPercent: isPercentPromo ? maxDiscountPercent : 0,
        discountAmount: maxDiscount,
        hasDiscount: maxDiscount > 0,
        bestPromo: bestPromotion,
        isPercentPromo: isPercentPromo,
      };
    }, [price, promos]);

  if (!p)
    return (
      <div className={styles.container}>
        <p>Đang tải…</p>
      </div>
    );

  const onAdd = async () => {
    if (!variant?.sku) return toast.error('Vui lòng chọn phân loại');
    await add({ productId: p._id, variantSku: variant.sku, qty: quantity });

    const coverId =
      variant?.imagePublicId ||
      p.images?.find?.((x) => x?.isPrimary)?.publicId ||
      p.images?.[0]?.publicId;

    showAddToCartToast({
      name: p.name,
      variantText: [variant?.color, variant?.size].filter(Boolean).join(' / '),
      price: Number(variant?.price ?? p.price),
      imageUrl: img(coverId, 160),
      duration: 2600,
      onViewCart: async () => {
        await refresh(); // ⬅️ đảm bảo dữ liệu giỏ đã “chuẩn hoá” có variantOptions
        navigate('/cart');
      },
    });
  };

  const onBuy = async () => {
    await onAdd(); // onAdd sẽ hiển thị toast; nếu muốn bỏ toast khi mua ngay thì tách riêng
    await refresh();
    navigate('/cart');
  };
  return (
    <div className={styles.container}>
      <div className={styles.page}>
        <div className={styles.grid}>
          {/* ẢNH SẢN PHẨM */}
          <div className={styles.gallery}>
            <div className={styles.mainImageBox}>
              <img src={img(activeImg, 1100)} alt={p.name} className={styles.mainImage} />
            </div>
            <div className={styles.thumbList}>
              {(p.images || []).map((im) => (
                <button
                  key={im.publicId}
                  onClick={() => setActiveImg(im.publicId)}
                  className={`${styles.thumbBtn} ${activeImg === im.publicId ? styles.active : ''}`}
                >
                  <img src={img(im.publicId, 160)} alt="" className={styles.thumbImg} />
                </button>
              ))}
            </div>
          </div>

          {/* THÔNG TIN SẢN PHẨM */}
          <div className={styles.info}>
            <h1 className={styles.name}>{p.name}</h1>

            <div className={styles.meta}>
              <span className={styles.stock}>{currentStock > 0 ? `` : 'Hết hàng'}</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#6b7280' }}>
                {Number(p?.ratingCount || 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>★</span>
                    <span>{Number(p.ratingAvg).toFixed(1)}</span>
                  </div>
                )}
                <div>{Intl.NumberFormat('vi-VN').format(Number(p?.ratingCount || 0))} đánh giá</div>
                <div>{Intl.NumberFormat('vi-VN').format(Number(soldQty || 0))} đã bán</div>
              </div>
            </div>

            {Number.isFinite(price) ? (
              <div className={styles.priceSection}>
                {hasDiscount ? (
                  <>
                    <div className={styles.priceNow}>
                      {new Intl.NumberFormat('vi-VN').format(finalPrice)} VND
                    </div>
                    <div className={styles.priceOriginal}>
                      {new Intl.NumberFormat('vi-VN').format(price)} VND
                    </div>
                    <div className={styles.discountBadge}>
                      {isPercentPromo
                        ? `-${discountPercent}%`
                        : `Giảm ${new Intl.NumberFormat('vi-VN').format(discountAmount)}đ`}
                    </div>
                  </>
                ) : (
                  <div className={styles.price}>
                    {new Intl.NumberFormat('vi-VN').format(price)} VND
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.price}>Liên hệ</div>
            )}

            {!!promos.length && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {promos.map((pm) => (
                  <span
                    key={pm.id}
                    style={{
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#b91c1c',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      padding: '3px 8px',
                      borderRadius: 8,
                    }}
                    title={`Khuyến mãi: ${pm.code}`}
                  >
                    {pm.code}
                  </span>
                ))}
              </div>
            )}

            {/* Chọn màu và size */}
            {!!p.variants?.length && (
              <div className={styles.variantBox}>
                <div className={styles.variantLabel}>Màu:</div>
                <div className={styles.variantList}>
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`${styles.variantBtn} ${color === c ? styles.active : ''}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className={styles.variantLabel} style={{ marginTop: 8 }}>
                  Size:
                </div>
                <div className={styles.variantList}>
                  {sizesForColor.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`${styles.variantBtn} ${size === s ? styles.active : ''}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* {variant?.stock !== undefined && (
                  <div className={styles.stockNote}>
                    {variant.stock > 0 ? `Còn ${variant.stock}` : 'Hết hàng'}
                  </div>
                )} */}
              </div>
            )}

            {/* Số lượng */}
            <div className={styles.qtyBox}>
              <span>Số lượng:</span>
              <button
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                disabled={currentStock > 0 ? quantity >= currentStock : false}
                onClick={() => setQuantity((q) => Math.min(q + 1, currentStock || q + 1))}
              >
                +
              </button>
            </div>

            {/* Nút hành động */}
            <div className={styles.actions}>
              {' '}
              <button className={styles.addBtn} onClick={onAdd} disabled={currentStock <= 0}>
                🛒 Thêm vào giỏ
              </button>
              <button className={styles.buyBtn} onClick={onBuy} disabled={currentStock <= 0}>
                Mua ngay
              </button>
            </div>

            {/* Mô tả */}
            <div className={styles.descBox}>
              <h3>Mô tả sản phẩm</h3>
              <p>{p.description || 'Chưa có mô tả chi tiết.'}</p>
            </div>
          </div>
        </div>

        {/* Review Section */}
        {p._id && <ReviewSection productId={p._id} />}
      </div>
    </div>
  );
}
