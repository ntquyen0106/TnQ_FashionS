import DashboardLayout from './layout/DashboardLayout';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProductsPage from './admin/ProductsPage';
import InventoryPage from './admin/InventoryPage';
import OrdersPage from './admin/OrdersPage';
import PromotionsPage from './admin/PromotionsPage';
import CategoriesPage from './admin/CategoriesPage';
import UsersPage from './admin/UsersPage';
import ReportsPage from './admin/ReportsPage';
import ChatbotPage from './admin/ChatbotPage';
import AdminProductNew from '@/pages/dashboard/admin/AdminProductNew';

const LINKS = [
  { to: '/dashboard/admin/products', label: 'Quản lý sản phẩm' },
  { to: '/dashboard/admin/inventory', label: 'Tồn kho' },
  { to: '/dashboard/admin/orders', label: 'Quản lý đơn hàng' },
  { to: '/dashboard/admin/promotions', label: 'Khuyến mãi' },
  { to: '/dashboard/admin/categories', label: 'Danh mục' },
  { to: '/dashboard/admin/users', label: 'Người dùng' },
  { to: '/dashboard/admin/reports', label: 'Thống kê & Báo cáo' },
  { to: '/dashboard/admin/chatbot', label: 'Quản lý chatbot' },
];

export default function AdminDashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout links={LINKS} />}>
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<AdminProductNew />} />

        {/* (tuỳ chọn) Sửa sản phẩm theo id hoặc slug */}
        {/* <Route path="products/:id" element={<AdminProductEdit />} /> */}

        <Route path="inventory" element={<InventoryPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chatbot" element={<ChatbotPage />} />
      </Route>
    </Routes>
  );
}
