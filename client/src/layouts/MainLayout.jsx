import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChatbotWidget from '../components/ChatbotWidget';
import { useAuth } from '@/auth/AuthProvider';

export default function MainLayout() {
  const loc = useLocation();
  const path = loc.pathname || '';
  const { user } = useAuth();

  // Hide menu for staff/admin when viewing order details
  const isOrderDetail = /^\/orders\/[^/]+$/.test(path); // matches /orders/:id but not /orders/:id/review
  const isStaffOrAdmin = user && (user.role === 'staff' || user.role === 'admin');
  const hideMenu = isOrderDetail && isStaffOrAdmin;
  const hideActions = hideMenu;

  // Ẩn chatbot trên các trang không cần thiết
  const hideChatbot =
    path.startsWith('/dashboard') || // Trang quản trị
    path.startsWith('/login') || // Trang đăng nhập
    path.startsWith('/register') || // Trang đăng ký
    path.startsWith('/checkout'); // Trang thanh toán

  return (
    <>
      <Navbar hideMenu={hideMenu} showSearch={!hideActions} showCart={!hideActions} />
      <Outlet />
      <Footer />
      {!hideChatbot && <ChatbotWidget />}
    </>
  );
}
