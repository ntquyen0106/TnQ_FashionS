import DashboardLayout from './layout/DashboardLayout';
import { Routes, Route, Navigate } from 'react-router-dom';
import OrderQueuePage from './staff/OrderQueuePage';
import MyOrdersPage from './staff/MyOrdersPage';
import UpdateStatusPage from './staff/UpdateStatusPage';
import PersonalStatsPage from './staff/PersonalStatsPage';

const LINKS = [
  { to: '/dashboard', label: 'Hàng đợi đơn hàng' },
  { to: '/dashboard/my-orders', label: 'Đơn hàng của tôi' },
  { to: '/dashboard/update-status', label: 'Cập nhật trạng thái' },
  { to: '/dashboard/stats', label: 'Thống kê cá nhân' },
];

export default function StaffDashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout links={LINKS} />}>
        <Route index element={<Navigate to="" replace />} />
        <Route path="" element={<OrderQueuePage />} />
        <Route path="my-orders" element={<MyOrdersPage />} />
        <Route path="update-status" element={<UpdateStatusPage />} />
        <Route path="stats" element={<PersonalStatsPage />} />
      </Route>
    </Routes>
  );
}
