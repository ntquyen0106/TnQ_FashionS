import { memo } from 'react';
import s from './AddToCartToast.module.css';

function AddToCartToast({ name, variantText, price, imageUrl, onClose, onViewCart }) {
  return (
    <div className={s.card} role="status" aria-live="polite">
      <div className={s.header}>
        <span>Thêm vào giỏ hàng thành công</span>
        <button className={s.x} onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>

      <div className={s.body}>
        <img className={s.thumb} src={imageUrl || '/no-image.png'} alt={name} />
        <div className={s.info}>
          <div className={s.name}>{name}</div>
          {variantText && <div className={s.variant}>{variantText}</div>}
          {Number.isFinite(price) && (
            <div className={s.price}>{new Intl.NumberFormat('vi-VN').format(price)}đ</div>
          )}
        </div>
      </div>

      <button
        className={s.cta}
        onClick={async () => {
          try {
            // ⬇️ CHỜ refresh + điều hướng xong mới đóng
            await onViewCart?.();
          } finally {
            onClose?.();
          }
        }}
      >
        XEM GIỎ HÀNG →
      </button>
    </div>
  );
}
export default memo(AddToCartToast);
