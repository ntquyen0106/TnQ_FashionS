// src/pages/dashboard/ProductsPage.jsx
import { Link } from 'react-router-dom';

export default function ProductsPage() {
  return (
    <div className="container" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2>Quản lý sản phẩm</h2>

        {/* Nút tạo sản phẩm mới */}
        <Link to="/dashboard/admin/products/new">
          <button
            style={{
              background: '#111',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            + Tạo sản phẩm
          </button>
        </Link>
      </div>

      <p>CRUD sản phẩm, biến thể (màu, size, SKU), hình ảnh, trạng thái hiển thị.</p>

      <ul>
        <li>Thêm / sửa / xóa sản phẩm</li>
        <li>Tìm kiếm & lọc theo danh mục, trạng thái</li>
        <li>Quản lý variants (giá & tồn kho per SKU)</li>
      </ul>

      {/* TODO: bạn có thể thêm bảng danh sách sản phẩm ở đây */}
      <div
        style={{
          marginTop: 24,
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p>Danh sách sản phẩm sẽ được hiển thị ở đây.</p>
      </div>
    </div>
  );
}
