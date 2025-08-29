import { useEffect, useState } from 'react';
import { http } from '../../../api/http';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [assigning, setAssigning] = useState({}); // {orderId: true}

  const load = async () => {
    const [o, s] = await Promise.all([
      http.get('/orders', { params: { status: 'new' } }), // đơn mới/chưa gán
      http.get('/users', { params: { role: 'staff' } }), // danh sách staff
    ]);
    setOrders(o.data.items || o.data || []);
    setStaffs(s.data.items || s.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async (orderId, staffId) => {
    if (!staffId) return;
    setAssigning((x) => ({ ...x, [orderId]: true }));
    try {
      await http.patch(`/orders/${orderId}/assign`, { staffId });
      await load();
    } finally {
      setAssigning((x) => ({ ...x, [orderId]: false }));
    }
  };

  return (
    <>
      <h2>Quản lý đơn hàng (Admin)</h2>
      <p>Đơn “mới/chưa gán”. Chọn nhân viên để gán đơn.</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Khách</th>
              <th>Tổng</th>
              <th>Trạng thái</th>
              <th>Gán cho</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id || o._id}>
                <td>{o.code || o._id}</td>
                <td>
                  {o.customerName} <br /> {o.customerPhone}
                </td>
                <td>{(o.total || 0).toLocaleString()} đ</td>
                <td>{o.status}</td>
                <td>
                  <select
                    defaultValue=""
                    onChange={(e) => assign(o.id || o._id, e.target.value)}
                    disabled={!!assigning[o.id || o._id]}
                  >
                    <option value="" disabled>
                      Chọn nhân viên
                    </option>
                    {staffs.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name || s.email}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5}>Không có đơn mới.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
