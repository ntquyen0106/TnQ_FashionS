import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from './layout/DashboardLayout';
import { Routes, Route, Navigate } from 'react-router-dom';
// import OrderQueuePage from './staff/OrderQueuePage';
import MyOrdersPage from './staff/MyOrdersPage';
import MyShiftsPage from './staff/MyShiftsPage';
import PersonalStatsPage from './staff/PersonalStatsPage';
import InventoryPage from './staff/InventoryPage';
import StaffChatPage from './staff/StaffChatPage';
import StaffReviewsPage from './staff/StaffReviewsPage';
import { chatbotApi } from '@/api/chatbot-api';
import { shiftApi } from '@/api';
import { reviewsApi } from '@/api/reviews-api';

const buildLinks = (chatBadge, reviewBadge) => [
  // Ẩn hàng đợi; điều hướng chính sang "Đơn hàng của tôi"
  { to: '/dashboard/my-orders', label: 'Đơn hàng của tôi', icon: '📋' },
  { to: '/dashboard/reviews', label: 'Đánh giá khách hàng', icon: '⭐', badge: reviewBadge },
  { to: '/dashboard/my-shifts', label: 'Ca làm của tôi', icon: '⏰' },
  { to: '/dashboard/inventory', label: 'Kho hàng', icon: '📦' },
  { to: '/dashboard/stats', label: 'Thống kê cá nhân', icon: '📊' },
  // Move chat to the end of the list so it appears at the bottom of the staff panel
  { to: '/dashboard/chat', label: 'Chat với khách', icon: '💬', badge: chatBadge },
];

export default function StaffDashboard() {
  const [chatCounts, setChatCounts] = useState({ waiting: 0, withStaff: 0, all: 0 });
  const [hasShifts, setHasShifts] = useState(null); // null = loading, true/false = result
  const [reviewBadge, setReviewBadge] = useState(0);
  const isMountedRef = useRef(false);

  // Check if staff has any shifts
  useEffect(() => {
    const checkShifts = async () => {
      try {
        const result = await shiftApi.shifts.mine({ limit: 1 });
        const shifts = result?.shifts || result || [];
        setHasShifts(shifts.length > 0);
      } catch (error) {
        console.error('[StaffDashboard] Error checking shifts:', error);
        setHasShifts(false);
      }
    };
    checkShifts();
  }, []);

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

  const handleReviewStatsChange = useCallback((nextStats) => {
    if (!nextStats) return;
    setReviewBadge(Number(nextStats?.pending || 0));
  }, []);

  useEffect(() => {
    let alive = true;
    const loadReviewStats = async () => {
      try {
        const stats = await reviewsApi.staffStats();
        if (alive) {
          setReviewBadge(Number(stats?.pending || 0));
        }
      } catch (error) {
        console.error('[StaffDashboard] Error loading review stats:', error);
      }
    };
    loadReviewStats();
    const interval = setInterval(loadReviewStats, 120000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const activeBadge = useMemo(
    () => Number(chatCounts.waiting || 0) + Number(chatCounts.withStaff || 0),
    [chatCounts.waiting, chatCounts.withStaff],
  );

  const links = useMemo(() => buildLinks(activeBadge, reviewBadge), [activeBadge, reviewBadge]);

  // Component to handle default route based on shift status
  const DefaultRoute = () => {
    if (hasShifts === null) {
      return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>;
    }
    return <Navigate to={hasShifts ? '/dashboard/my-orders' : '/dashboard/my-shifts'} replace />;
  };

  return (
    <Routes>
      <Route element={<DashboardLayout links={links} />}>
        {/* Điều hướng mặc định dựa trên việc có ca hay không */}
        <Route index element={<DefaultRoute />} />
        {/* Duy trì route cũ nếu có bookmark */}
        <Route path="queue" element={<MyOrdersPage />} />
        <Route path="my-orders" element={<MyOrdersPage />} />
        <Route
          path="reviews"
          element={<StaffReviewsPage onStatsChange={handleReviewStatsChange} />}
        />
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
