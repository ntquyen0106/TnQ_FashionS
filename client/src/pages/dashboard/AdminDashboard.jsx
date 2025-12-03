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
import ShiftsPage from './admin/ShiftsPage';
import AdminProductNew from '@/pages/dashboard/admin/AdminProductNew';
import AdminProductEdit from '@/pages/dashboard/admin/AdminProductEdit';

const LINKS = [
  { to: '/dashboard/admin/orders', label: 'Đơn hàng', icon: '📦' },
  { to: '/dashboard/admin/products', label: 'Sản phẩm', icon: '👕' },
  { to: '/dashboard/admin/inventory', label: 'Kho', icon: '📊' },
  { to: '/dashboard/admin/categories', label: 'Danh mục', icon: '🗂️' },
  { to: '/dashboard/admin/promotions', label: 'Khuyến mãi', icon: '🎁' },
  { to: '/dashboard/admin/users', label: 'Nhân sự', icon: '👥' },
  { to: '/dashboard/admin/shifts', label: 'Quản lý ca', icon: '🕐' },
  { to: '/dashboard/admin/reports', label: 'Thống kê', icon: '📈' },
  { to: '/dashboard/admin/chatbot', label: 'Chatbot', icon: '🤖' },
];

export default function AdminDashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout links={LINKS} />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<AdminProductNew />} />
        <Route path="products/:id" element={<AdminProductEdit />} />

        {/* (tuỳ chọn) Sửa sản phẩm theo id hoặc slug */}
        {/* <Route path="products/:id" element={<AdminProductEdit />} /> */}

        <Route path="inventory" element={<InventoryPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="chatbot" element={<ChatbotPage />} />
      </Route>
    </Routes>
  );
}
