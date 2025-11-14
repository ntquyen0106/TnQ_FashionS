import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from './layout/DashboardLayout';
import { Routes, Route } from 'react-router-dom';
// import OrderQueuePage from './staff/OrderQueuePage';
import MyOrdersPage from './staff/MyOrdersPage';
import MyShiftsPage from './staff/MyShiftsPage';
import PersonalStatsPage from './staff/PersonalStatsPage';
import InventoryPage from './staff/InventoryPage';
import StaffChatPage from './staff/StaffChatPage';
import { chatbotApi } from '@/api/chatbot-api';

const buildLinks = (chatBadge) => [
  // Ẩn hàng đợi; điều hướng chính sang "Đơn hàng của tôi"
  { to: '/dashboard/my-orders', label: 'Đơn hàng của tôi' },
  { to: '/dashboard/my-shifts', label: 'Ca làm của tôi' },
  { to: '/dashboard/inventory', label: 'Kho hàng' },
  { to: '/dashboard/stats', label: 'Thống kê cá nhân' },
  // Move chat to the end of the list so it appears at the bottom of the staff panel
  { to: '/dashboard/chat', label: '💬 Chat với khách', badge: chatBadge },
];

export default function StaffDashboard() {
  const [chatCounts, setChatCounts] = useState({ waiting: 0, withStaff: 0, all: 0 });
  const isMountedRef = useRef(false);

  const refreshChatCounts = useCallback(async () => {
    try {
      const [waitingResp, withStaffResp] = await Promise.all([
        chatbotApi.getStaffSessions({ status: 'waiting_staff' }),
        chatbotApi.getStaffSessions({ status: 'with_staff', assignedToMe: true }),
      ]);

      const waitingSessions = waitingResp?.data?.sessions || [];
      const withStaffSessions = withStaffResp?.data?.sessions || [];

      const waiting = waitingSessions.filter((s) => s.status === 'waiting_staff').length;
      const withStaff = withStaffSessions.filter((s) => s.status === 'with_staff').length;
      const all = waiting + withStaff;

      if (isMountedRef.current) {
        setChatCounts({ waiting, withStaff, all });
      }
    } catch (error) {
      console.error('[StaffDashboard] Error loading chat session counts:', error);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    refreshChatCounts();
    const intervalId = setInterval(refreshChatCounts, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [refreshChatCounts]);

  const handleCountsChange = useCallback((nextCounts) => {
    if (!nextCounts) return;
    if (isMountedRef.current) {
      setChatCounts(nextCounts);
    }
  }, []);

  const activeBadge = useMemo(
    () => Number(chatCounts.waiting || 0) + Number(chatCounts.withStaff || 0),
    [chatCounts.waiting, chatCounts.withStaff],
  );

  const links = useMemo(() => buildLinks(activeBadge), [activeBadge]);

  return (
    <Routes>
      <Route element={<DashboardLayout links={links} />}>
        {/* Mặc định hiển thị Đơn hàng của tôi */}
        <Route index element={<MyOrdersPage />} />
        {/* Duy trì route cũ nếu có bookmark */}
        <Route path="queue" element={<MyOrdersPage />} />
        <Route path="my-orders" element={<MyOrdersPage />} />
        <Route
          path="chat"
          element={<StaffChatPage onCountsChange={handleCountsChange} initialCounts={chatCounts} />}
        />
        <Route path="my-shifts" element={<MyShiftsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="stats" element={<PersonalStatsPage />} />
      </Route>
    </Routes>
  );
}
