import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function OrderSuccess() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const orderId = state?.orderId || null;
  const orderCode = state?.orderCode || null;

  return (
    <div
      style={{
        maxWidth: 680,
        margin: '40px auto',
        padding: 24,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img
          src="https://img.icons8.com/fluency/96/ok.png"
          alt="success"
          width="72"
          height="72"
          style={{ opacity: 0.9 }}
        />
        <h2 style={{ margin: '12px 0 4px' }}>Bạn đã đặt hàng thành công</h2>
        {orderCode ? (
          <div style={{ color: '#555' }}>
            Mã đơn: <strong>{orderCode}</strong>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Về trang chủ
        </button>
        <Link
          to="/orders"
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #0ea5e9',
            background: '#0ea5e9',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Đơn hàng của tôi
        </Link>
        {orderId ? (
          <Link
            to={`/orders/${orderId}`}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            Xem chi tiết đơn
          </Link>
        ) : null}
      </div>
    </div>
  );
}
