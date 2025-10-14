import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import styles from './OrderDetail.module.css';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
const STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PACKING: 'Đang đóng gói',
  SHIPPING: 'Đang giao',
  DONE: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const PM_LABEL = {
  COD: 'Thanh toán khi nhận hàng',
  BANK: 'Thanh toán online',
};

const useCloudImage = () => {
  const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  return (snap, w = 96) => {
    if (!snap) return '/no-image.png';
    if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
    const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
    return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
  };
};

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const buildImageUrl = useCloudImage();

  useEffect(() => {
    (async () => {
      try {
        const res = await ordersApi.get(id);
        setOrder(res || null);
      } catch (e) {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className={styles.wrap}>Đang tải…</div>;
  if (!order) return <div className={styles.wrap}>Không tìm thấy đơn.</div>;

  const amounts = order.amounts || {};
  const addr = order.shippingAddress || {};
  const code = order.code || order._id;
  const status = String(order.status || 'PENDING');
  const pmLabel = PM_LABEL[order.paymentMethod] || order.paymentMethod || '—';

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => nav('/orders')} aria-label="Quay lại">
          <span className={styles.arrow}>←</span>
        </button>
        <div className={styles.titleBox}>
          <h2>Chi tiết đơn hàng</h2>
        </div>
        <div className={`${styles.chip} ${styles[`st_${status}`]}`}>
          {STATUS_LABEL[status] || status}
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Thông tin giao hàng</h3>
          <div className={styles.addr}>
            <div>
              <strong>{addr.fullName}</strong> · {addr.phone}
            </div>
            <div className={styles.addrLine}>
              {addr.line1}, {addr.ward}, {addr.district}, {addr.city}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Sản phẩm</h3>
          <div className={styles.items}>
            {(order.items || []).map((it, idx) => (
              <div key={idx} className={styles.item}>
                <img src={buildImageUrl(it.imageSnapshot)} alt={it.nameSnapshot} />
                <div className={styles.meta}>
                  <div className={styles.name}>{it.nameSnapshot}</div>
                  {it.variantSku && <div className={styles.sku}>{it.variantSku}</div>}
                </div>
                <div className={styles.unit}>{fmtVND(it.price)}₫</div>
                <div className={styles.qty}>x{it.qty}</div>
                <div className={styles.line}>{fmtVND(it.lineTotal)}₫</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3>Chi tiết đơn hàng</h3>
          <div className={styles.totals}>
            <div>
              <span>Mã đơn</span>
              <span>{code}</span>
            </div>
            <div>
              <span>Ngày đặt</span>
              <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
            </div>
            <div>
              <span>Phương thức</span>
              <span>{pmLabel}</span>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Thanh toán</h3>
          <div className={styles.totals}>
            <div>
              <span>Tạm tính</span>
              <span>{fmtVND(amounts.subtotal)}₫</span>
            </div>
            <div>
              <span>Giảm giá</span>
              <span>-{fmtVND(amounts.discount)}₫</span>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <span>{fmtVND(amounts.shippingFee)}₫</span>
            </div>
            <div className={styles.hr} />
            <div className={styles.grand}>
              <span>Tổng thanh toán</span>
              <span>{fmtVND(amounts.grandTotal)}₫</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
