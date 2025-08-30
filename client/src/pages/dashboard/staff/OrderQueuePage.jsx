// client/src/pages/dashboard/staff/OrderQueuePage.jsx
import { useEffect, useState } from 'react';
import { http } from '../../../api/http';

export default function OrderQueuePage() {
  const [queue, setQueue] = useState([]);
  const [claiming, setClaiming] = useState({});

  const load = async () => {
    const { data } = await http.get('/orders', {
      params: { status: 'new', unassigned: true },
    });
    setQueue(data.items || data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (orderId) => {
    setClaiming((x) => ({ ...x, [orderId]: true }));
    try {
      await http.post(`/orders/${orderId}/claim`);
      await load();
    } finally {
      setClaiming((x) => ({ ...x, [orderId]: false }));
    }
  };

  return (
    <>
      <h2>Hàng đợi đơn hàng</h2>
      <p>Đơn mới/chưa gán. Bạn có thể “Nhận đơn”.</p>
      <div className="cards">
        {queue.map((o) => (
          <div className="card" key={o.id || o._id}>
            <div>
              <b>{o.code || o._id}</b> — {o.status}
            </div>
            <div>
              Khách: {o.customerName} — {o.customerPhone}
            </div>
            <div>Tổng: {(o.total || 0).toLocaleString()} đ</div>
            <button
              className="btn"
              onClick={() => claim(o.id || o._id)}
              disabled={!!claiming[o.id || o._id]}
            >
              Nhận đơn
            </button>
          </div>
        ))}
        {queue.length === 0 && <div>Không có đơn trong hàng đợi.</div>}
      </div>
    </>
  );
}
