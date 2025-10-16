import DashboardLayout from './layout/DashboardLayout';
import { Routes, Route, Navigate } from 'react-router-dom';
import OrderQueuePage from './staff/OrderQueuePage';
import MyOrdersPage from './staff/MyOrdersPage';
import PersonalStatsPage from './staff/PersonalStatsPage';
import InventoryPage from './staff/InventoryPage';

const LINKS = [
  { to: '/dashboard', label: 'Hàng đợi đơn hàng' },
  { to: '/dashboard/my-orders', label: 'Đơn hàng của tôi' },
  { to: '/dashboard/inventory', label: 'Kho hàng' },
  { to: '/dashboard/stats', label: 'Thống kê cá nhân' },
];

export default function StaffDashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout links={LINKS} />}>
        {/* Render OrderQueuePage at /dashboard by default */}
        <Route index element={<OrderQueuePage />} />
        <Route path="my-orders" element={<MyOrdersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="stats" element={<PersonalStatsPage />} />
      </Route>
    </Routes>
  );
}
