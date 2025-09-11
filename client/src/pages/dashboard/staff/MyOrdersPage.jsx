import { useEffect, useState } from 'react';
import { ordersApi } from '@/api';

export default function MyOrdersPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const data = await ordersApi.list({ assignee: 'me', status: status || undefined });
      setItems(data.items || data || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  return (
    <>
      <h2>Đơn hàng của tôi</h2>
      <div style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="processing">Đang xử lý</option>
          <option value="packed">Đã đóng gói</option>
          <option value="shipped">Đang giao</option>
          <option value="completed">Hoàn tất</option>
          <option value="canceled">Hủy</option>
        </select>
      </div>

      <div className="cards">
        {items.map((o) => (
          <div className="card" key={o.id || o._id}>
            <div>
              <b>{o.code || o._id}</b> — {o.status}
            </div>
            <div>
              Khách: {o.customerName} — {o.customerPhone}
            </div>
            <div>Tổng: {(o.total || 0).toLocaleString()} đ</div>
          </div>
        ))}
        {items.length === 0 && <div>Không có đơn.</div>}
      </div>
    </>
  );
}
