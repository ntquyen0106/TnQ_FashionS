import { useNavigate } from 'react-router-dom';
import AdminProductForm from './AdminProductForm';
import { productsApi } from '@/api/products-api';

export default function AdminProductNew() {
  const nav = useNavigate();

  const handleSubmit = async (payload) => {
    // bạn có thể show loading/toast tùy ý
    const created = await productsApi.create(payload);
    // điều hướng sau khi tạo xong
    nav(`/dashboard/products/${created._id ?? 'list'}`);
  };

  return (
    <div className="container" style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Tạo sản phẩm mới</h1>
      <AdminProductForm onSubmit={handleSubmit} />
    </div>
  );
}
