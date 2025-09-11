import { useState } from 'react';
import { ordersApi } from '@/api';

export default function UpdateStatusPage() {
  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState('processing');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await ordersApi.updateStatus(orderId, status);
      setMsg('Cập nhật thành công');
      setOrderId('');
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Lỗi cập nhật');
    }
  };

  return (
    <>
      <h2>Cập nhật trạng thái đơn</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <input
          placeholder="Mã đơn / ID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="processing">Đang xử lý</option>
          <option value="packed">Đã đóng gói</option>
          <option value="shipped">Đang giao</option>
          <option value="completed">Hoàn tất</option>
          <option value="canceled">Hủy</option>
        </select>
        <button className="btn">Cập nhật</button>
        {msg && <div>{msg}</div>}
      </form>
    </>
  );
}
