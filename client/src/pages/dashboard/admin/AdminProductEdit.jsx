import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminProductForm from './AdminProductForm';
import { productsApi } from '@/api/products-api';

export default function AdminProductEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await productsApi.detail(id);
        if (mounted) setInitial(d);
      } catch (e) {
        alert('Không tải được sản phẩm');
        nav('/dashboard/admin/products');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id, nav]);

  const handleSubmit = async (payload) => {
    await productsApi.update(id, payload);
    nav('/dashboard/admin/products');
  };

  if (loading)
    return (
      <div className="container" style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
              color: '#111',
            }}
          >
            <span aria-hidden>⏳</span>
            <span>Đang tải dữ liệu sản phẩm…</span>
          </div>
        </div>
      </div>
    );
  if (!initial) return null;

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
        <h1 style={{ margin: 0 }}>Sửa sản phẩm</h1>
      </div>
      <AdminProductForm onSubmit={handleSubmit} initial={initial} />
    </div>
  );
}
