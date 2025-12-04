import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import paymentsApi from '@/api/payments-api';
import styles from './OrderSuccess.module.css';

export default function OrderSuccess() {
  const { state } = useLocation();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const orderId = state?.orderId || sp.get('orderId') || null;
  const orderCode = state?.orderCode || null;
  const cancelled = state?.cancelled || sp.get('cancelled') === 'true';

  const [loading, setLoading] = useState(!!orderId);
  const [info, setInfo] = useState(null);
  const [countdown, setCountdown] = useState(6); // đếm 6s chờ PayOS confirm
  const [polling, setPolling] = useState(!!orderId);

  useEffect(() => {
    if (cancelled) {
      toast('Bạn đã hủy thanh toán. Đơn hàng vẫn đang chờ được thanh toán lại.');
    }
  }, [cancelled]);

  // Poll trạng thái trong vài giây đầu để chờ PayOS webhook/confirm
  useEffect(() => {
    if (!orderId) return;
    let timer;
    let poller;
    setLoading(true);
    setPolling(true);

    const fetchOnce = async () => {
      try {
        const res = await paymentsApi.check(orderId);
        setInfo(res);
        // Nếu đã thanh toán → dừng ngay
        if (res?.isPaid || String(res?.status).toUpperCase() !== 'AWAITING_PAYMENT') {
          setPolling(false);
          setLoading(false);
        }
      } catch {
        // bỏ qua lỗi lẻ tẻ, tiếp tục chờ
      }
    };

    // Gọi ngay + thiết lập poll mỗi 1s
    fetchOnce();
    poller = setInterval(fetchOnce, 1000);

    // Đếm ngược hiển thị
    timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setPolling(false);
          setLoading(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(poller);
    };
  }, [orderId]);

  // reload thủ công không còn cần thiết vì đã có auto-poll ngắn hạn ở trên

  const cancelPayment = async () => {
    try {
      await paymentsApi.userCancelPayment(orderId);
      const res = await paymentsApi.check(orderId);
      setInfo(res);
      toast.success('Đã hủy thanh toán');
    } catch {
      toast.error('Hủy thanh toán thất bại');
    }
  };

  const status = info?.status?.toUpperCase() || 'PENDING';
  const isPaid = !!info?.isPaid;
  const method = (info?.paymentMethod || state?.method || '').toUpperCase();
  const awaiting = status === 'AWAITING_PAYMENT' && !isPaid && method === 'BANK';
  const showAwaitingNotice = cancelled && awaiting && !loading;

  const payAgain = async () => {
    if (!orderId) return;
    try {
      const res = await paymentsApi.createLink(orderId);
      const url = res?.paymentData?.checkoutUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error('Không tạo được link thanh toán');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Không tạo được link thanh toán');
    }
  };

  const showCancelBtn = status === 'AWAITING_PAYMENT' && !isPaid && method === 'BANK';

  const shortCode = (() => {
    if (orderCode && String(orderCode).length >= 6) return String(orderCode).slice(-6);
    if (orderId && String(orderId).length >= 6) return String(orderId).slice(-6);
    return null;
  })();

  return (
    <div className={styles.wrapper}>
      <img
        src="https://img.icons8.com/fluency/96/ok.png"
        alt="success"
        width="72"
        height="72"
        className={styles.icon}
      />
      <h2 className={styles.title}>Bạn đã đặt hàng thành công</h2>
      {shortCode && (
        <div className={styles.code} style={{ opacity: 0.8, fontSize: 14 }}>
          Mã đơn: <strong>#{shortCode}</strong>
        </div>
      )}

      {loading ? (
        <div className={styles.status}>
          Đang kiểm tra thanh toán... {countdown > 0 ? `(~${countdown}s)` : ''}
        </div>
      ) : isPaid ? (
        <div className={styles.status}>
          Trạng thái: <strong>Đã thanh toán</strong>
        </div>
      ) : awaiting ? (
        <div className={styles.status}>
          Đơn hàng đang chờ thanh toán. Bạn có thể thanh toán lại hoặc hủy thanh toán.
        </div>
      ) : (
        <div className={styles.status}>
          Trạng thái:{' '}
          <strong>
            {status === 'PENDING' ? 'Chờ xác nhận' : status === 'DONE' ? 'Hoàn tất' : status}
          </strong>
        </div>
      )}

      {showAwaitingNotice && (
        <div className={styles.notice}>
          Bạn vừa hủy thao tác thanh toán tại PayOS. Đơn hàng vẫn ở trạng thái chờ thanh toán, hãy
          nhấn "Thanh toán lại" để hoàn tất hoặc chọn phương thức khác.
        </div>
      )}

      <div className={styles.actions}>
        <button onClick={() => navigate('/')} className={`${styles.btn} ${styles.btnHome}`}>
          Về trang chủ
        </button>
        <Link to="/orders" className={`${styles.btn} ${styles.btnBlue}`}>
          Đơn hàng của tôi
        </Link>
        {orderId && (
          <Link to={`/orders/${orderId}`} className={`${styles.btn} ${styles.btnDark}`}>
            Xem chi tiết đơn
          </Link>
        )}
        {orderId && (
          <>
            {awaiting && (
              <button onClick={payAgain} className={`${styles.btn} ${styles.btnPrimary}`}>
                Thanh toán lại
              </button>
            )}
            {showCancelBtn && (
              <button onClick={cancelPayment} className={`${styles.btn} ${styles.btnDanger}`}>
                Hủy thanh toán
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
