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

  if (loading) return <div style={{ padding: 16 }}>Đang tải…</div>;
  if (!initial) return null;

  return (
    <div className="container" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => nav(-1)}>{'← Quay lại'}</button>
        <h1 style={{ margin: 0 }}>Sửa sản phẩm</h1>
      </div>
      <AdminProductForm onSubmit={handleSubmit} initial={initial} />
    </div>
  );
}
