import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminProductForm from './AdminProductForm';
import { productsApi } from '@/api/products-api';
import ConfirmModal from '@/components/ConfirmModal';

export default function AdminProductNew() {
  const nav = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stayHere, setStayHere] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const pendingPayloadRef = useRef(null);

  const handleSubmit = async (payload) => {
    // Trước khi tạo, hiển thị modal xác nhận
    pendingPayloadRef.current = payload;
    setConfirmOpen(true);
  };

  const doCreate = async () => {
    if (!pendingPayloadRef.current) return;
    try {
      setCreating(true);
      const created = await productsApi.create(pendingPayloadRef.current);
      const id = created?._id || created?.id;
      if (stayHere) {
        // Ở lại trang để tạo tiếp: reset form bằng cách đổi key
        setFormKey((k) => k + 1);
      } else {
        // Luôn quay về trang quản lý sản phẩm sau khi tạo xong
        nav('/dashboard/admin/products');
      }
    } finally {
      setCreating(false);
      setConfirmOpen(false);
      pendingPayloadRef.current = null;
    }
  };

  return (
    <div className="container" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => nav(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: '#fff',
            color: '#111',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          onMouseDown={(e) => (e.currentTarget.style.background = '#eee')}
          onMouseUp={(e) => (e.currentTarget.style.background = '#f5f5f5')}
        >
          <span aria-hidden>←</span>
          <span>Quay lại</span>
        </button>
        <h1 style={{ margin: 0 }}>Thêm sản phẩm</h1>
      </div>
      <AdminProductForm key={formKey} onSubmit={handleSubmit} />

      <ConfirmModal
        open={confirmOpen}
        title="Xác nhận tạo sản phẩm"
        message={
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Bạn có chắc chắn muốn tạo sản phẩm này?</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={stayHere}
                onChange={(e) => setStayHere(e.target.checked)}
              />
              Ở lại trang này để tạo tiếp sản phẩm khác sau khi tạo
            </label>
          </div>
        }
        confirmText={creating ? 'Đang tạo…' : 'Tạo'}
        cancelText="Hủy"
        confirmType="primary"
        disabled={creating}
        onConfirm={doCreate}
        onCancel={() => {
          setConfirmOpen(false);
          pendingPayloadRef.current = null;
        }}
      />
    </div>
  );
}
