import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartProvider';
import styles from './CartPage.module.css';
import { toast } from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const buildImageUrl = (snap, w = 160) => {
  if (!snap) return '/no-image.png';
  if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
  const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
};

export default function CartPage() {
  const { cart, add, updateQty, updateVariant, remove, removeMany } = useCart();
  const nav = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const [confirm, setConfirm] = useState({ open: false, onConfirm: null, message: '' });

  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => {
    const valid = new Set(items.map((x) => x._id));
    setSelected((prev) => new Set([...prev].filter((id) => valid.has(id))));
  }, [items]);

  const cartTotal = useMemo(
    () =>
      items.reduce(
        (s, it) =>
          s + (Number(it.price ?? it.priceSnapshot) || 0) * (Number(it.quantity ?? it.qty) || 0),
        0,
      ),
    [items],
  );

  const selectedTotal = useMemo(() => {
    const ids = selected;
    return items.reduce((s, it) => {
      if (!ids.has(it._id)) return s;
      const price = Number(it.price ?? it.priceSnapshot) || 0;
      const qty = Number(it.quantity ?? it.qty) || 0;
      return s + price * qty;
    }, 0);
  }, [items, selected]);

  // Chỉ tính tổng cho các sản phẩm đã chọn; nếu chưa chọn gì -> 0 VND
  const displayTotal = selected.size > 0 ? selectedTotal : 0;

  if (!items.length)
    return (
      <div className={styles.container}>
        <div className={styles.page}>
          <h2>Giỏ hàng</h2>
          <p>
            Chưa có sản phẩm. <Link to="/products">Tiếp tục mua sắm</Link>
          </p>
        </div>
      </div>
    );

  const inc = async (it) => {
    setBusyId(it._id);
    try {
      await updateQty(it._id, (Number(it.quantity) || 1) + 1);
    } finally {
      setBusyId(null);
    }
  };

  const dec = async (it) => {
    const current = Number(it.quantity ?? it.qty) || 1;
    if (current <= 1) {
      setConfirm({
        open: true,
        message: 'Bạn chắc chắn muốn bỏ sản phẩm này?',
        onConfirm: async () => {
          setConfirm({ open: false, onConfirm: null, message: '' });
          await del(it);
        },
      });
      return;
    }
    setBusyId(it._id);
    try {
      await updateQty(it._id, current - 1);
    } finally {
      setBusyId(null);
    }
  };

  const del = async (it) => {
    setBusyId(it._id);
    try {
      await remove(it._id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(it._id);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleItem = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = selected.size > 0 && selected.size === items.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((x) => x._id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return toast('Chưa chọn sản phẩm nào.', { icon: '🧺' });
    const ids = [...selected];
    setConfirm({
      open: true,
      message: `Bạn có chắc muốn xóa ${ids.length} sản phẩm đã chọn?`,
      onConfirm: async () => {
        setConfirm({ open: false, onConfirm: null, message: '' });
        try {
          await removeMany(ids);
          setSelected(new Set());
        } catch {
          toast.error('Xóa không thành công, thử lại.');
        }
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.page}>
        <h2>Giỏ hàng</h2>

        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>Chọn tất cả</span>
          </label>

          <div className={styles.toolsRight}>
            <button
              className={styles.clear}
              onClick={deleteSelected}
              disabled={selected.size === 0}
            >
              Xóa
            </button>
          </div>
        </div>

        <div className={styles.table}>
          {items.map((raw) => {
            const pid = raw.productId?._id || raw.productId;
            const key =
              raw._id || raw.id || (pid && raw.variantSku ? `${pid}-${raw.variantSku}` : '');
            const it = {
              _id: raw._id,
              productId: pid,
              slug: raw.slug || raw.slugSnapshot || raw.productId?.slug || null,
              name: raw.name || raw.nameSnapshot || raw.product?.name || 'Sản phẩm',
              imageUrl: raw.imageUrl || buildImageUrl(raw.imageSnapshot),
              variantSku: raw.variantSku,
              variantName: raw.variantName,
              color: raw.color,
              size: raw.size,
              price: Number(raw.price ?? raw.priceSnapshot) || 0,
              quantity: Number(raw.quantity ?? raw.qty) || 1,
              variantOptions: raw.variantOptions || [],
            };

            const disabled = busyId === it._id;
            const checked = selected.has(it._id);

            // Build color/size lists from variant options
            const colors = Array.from(
              new Set(it.variantOptions.map((v) => v.color).filter((c) => !!c)),
            );
            const sizes = Array.from(
              new Set(it.variantOptions.map((v) => v.size).filter((s) => !!s)),
            );

            // Available sizes for the current/selected color
            const sizesForColor = (color) =>
              Array.from(
                new Set(
                  it.variantOptions
                    .filter((v) => v.color === color)
                    .map((v) => v.size)
                    .filter((s) => !!s),
                ),
              );

            // Available colors for the current/selected size
            const colorsForSize = (size) =>
              Array.from(
                new Set(
                  it.variantOptions
                    .filter((v) => v.size === size)
                    .map((v) => v.color)
                    .filter((c) => !!c),
                ),
              );

            const changeVariantByColor = async (newColor) => {
              try {
                // Prefer keeping current size if combo exists
                let target = it.variantOptions.find(
                  (v) => v.color === newColor && v.size === it.size,
                );
                if (!target) {
                  // Fallback: pick the first available size for that color
                  const availableSizes = sizesForColor(newColor);
                  target = it.variantOptions.find(
                    (v) =>
                      v.color === newColor &&
                      (!availableSizes.length || v.size === availableSizes[0]),
                  );
                }
                if (target) await updateVariant(it._id, target.sku);
                else toast.error('Biến thể không khả dụng');
              } catch (e) {
                toast.error('Không thể đổi màu');
              }
            };

            const changeVariantBySize = async (newSize) => {
              try {
                // Prefer keeping current color if combo exists
                let target = it.variantOptions.find(
                  (v) => v.size === newSize && v.color === it.color,
                );
                if (!target) {
                  // Fallback: pick the first available color for that size
                  const availableColors = colorsForSize(newSize);
                  target = it.variantOptions.find(
                    (v) =>
                      v.size === newSize &&
                      (!availableColors.length || v.color === availableColors[0]),
                  );
                }
                if (target) await updateVariant(it._id, target.sku);
                else toast.error('Biến thể không khả dụng');
              } catch (e) {
                toast.error('Không thể đổi size');
              }
            };

            return (
              <div key={key} className={styles.row}>
                <div className={styles.cellSelect}>
                  <input type="checkbox" checked={checked} onChange={() => toggleItem(it._id)} />
                </div>

                <div className={styles.prod}>
                  {it.slug ? (
                    <Link to={`/product/${it.slug}`} className={styles.link}>
                      <img src={it.imageUrl} alt={it.name} />
                    </Link>
                  ) : (
                    <img src={it.imageUrl} alt={it.name} />
                  )}

                  <div>
                    {it.slug ? (
                      <Link to={`/product/${it.slug}`} className={styles.link}>
                        <div className={styles.name}>{it.name}</div>
                      </Link>
                    ) : (
                      <div className={styles.name}>{it.name}</div>
                    )}

                    {(colors.length > 1 || sizes.length > 1) && (
                      <div className={styles.variantSelectors}>
                        {colors.length > 1 && (
                          <select
                            className={styles.variantSelect}
                            disabled={disabled}
                            value={it.color || ''}
                            onChange={(e) => changeVariantByColor(e.target.value)}
                          >
                            {colors.map((c) => {
                              const disabledOption =
                                sizes.length > 0 && sizesForColor(c).length === 0;
                              return (
                                <option key={c} value={c} disabled={disabledOption}>
                                  {c}
                                </option>
                              );
                            })}
                          </select>
                        )}
                        {sizes.length > 1 && (
                          <select
                            className={styles.variantSelect}
                            disabled={disabled}
                            value={it.size || ''}
                            onChange={(e) => changeVariantBySize(e.target.value)}
                          >
                            {sizes.map((s) => {
                              const disabledOption =
                                colors.length > 0 && colorsForSize(s).length === 0;
                              return (
                                <option key={s} value={s} disabled={disabledOption}>
                                  {s}
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    )}

                    {it.variantName && <div className={styles.variant}>{it.variantName}</div>}
                  </div>
                </div>

                <div className={styles.price}>{fmtVND(it.price)} VND</div>

                <div className={styles.qty}>
                  <button disabled={disabled} onClick={() => dec(it)}>
                    −
                  </button>
                  <span>{it.quantity}</span>
                  <button disabled={disabled} onClick={() => inc(it)}>
                    +
                  </button>
                </div>

                <div className={styles.lineTotal}>{fmtVND(it.price * it.quantity)} VND</div>

                <div className={styles.actions}>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    disabled={disabled}
                    onClick={() => del(it)}
                    aria-label="Xóa"
                    title="Xóa"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <div className={styles.total}>
            {selected.size > 0 ? (
              <>
                Tổng (đã chọn {selected.size}): <strong>{fmtVND(displayTotal)} VND</strong>
              </>
            ) : (
              <>
                Tổng: <strong>{fmtVND(displayTotal)} VND</strong>
              </>
            )}
          </div>
          <button
            className={styles.checkout}
            disabled={selected.size === 0}
            onClick={() => nav('/checkout', { state: { selectedIds: [...selected] } })}
          >
            Thanh toán
          </button>
        </div>
      </div>
      <ConfirmModal
        open={confirm.open}
        title="Xác nhận"
        message={confirm.message}
        confirmText="Đồng ý"
        cancelText="Hủy"
        confirmType="danger"
        onCancel={() => setConfirm({ open: false, onConfirm: null, message: '' })}
        onConfirm={confirm.onConfirm}
      />
    </div>
  );
}
