import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './VoucherPicker.module.css';
import { promotionsApi } from '@/api/promotions-api';

export default function VoucherPicker({
  open,
  subtotal = 0,
  onClose,
  onPick,
  productIds = [],
  categoryIds = [],
}) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        // Lấy tất cả voucher đang hiệu lực, kèm cờ eligible để người dùng biết điều kiện
        // Pass product/category context so server can filter applicable promotions
        const data = await promotionsApi.available(subtotal, {
          all: true,
          productIds: productIds || [],
          categoryIds: categoryIds || [],
        });
        setList(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, subtotal]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>Chọn phiếu giảm giá</span>
          <button className={styles.btn} onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.item}>Đang tải…</div>
          ) : list.length === 0 ? (
            <div className={styles.item}>Không có mã phù hợp</div>
          ) : (
            list.map((p) => (
              <div key={p.id} className={styles.item}>
                <div className={styles.meta}>
                  <div className={styles.code}>{p.code}</div>
                  <div className={styles.desc}>
                    {p.type === 'percent' ? `${p.value}%` : `${p.value.toLocaleString()}₫`} · ĐH tối
                    thiểu {Number(p.minOrder || 0).toLocaleString()}₫
                    {!p.eligible && (
                      <span style={{ color: '#b91c1c', marginLeft: 6 }}>(chưa đủ điều kiện)</span>
                    )}
                    {!p.applicable && (
                      <span style={{ color: '#b91c1c', marginLeft: 6 }}>
                        (không áp dụng cho sản phẩm trong giỏ)
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.btn} ${styles.primary}`}
                    onClick={() => onPick?.(p)}
                    disabled={!p.eligible || !p.applicable}
                    title={
                      !p.applicable
                        ? 'Phiếu không áp dụng cho sản phẩm trong giỏ'
                        : !p.eligible
                        ? 'Chưa đạt đơn tối thiểu'
                        : 'Áp dụng ngay'
                    }
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
