import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Products from './pages/Products';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyCode from './pages/VerifyCode';
import Forgot from './pages/Forgot';
import ResetPassword from './pages/ResetPassword';
import { ProtectedRoute, RoleRoute, MustChangePasswordGuard } from './auth/guards';
import FirstLoginChangePassword from '@/pages/FirstLoginChangePassword';
import AddPhone from '@/pages/AddPhone';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import StaffDashboard from './pages/dashboard/StaffDashboard';
import ProductDetail from '@/pages/ProductDetail';
import AdminProductNew from '@/pages/dashboard/admin/AdminProductNew';
import CartPage from '@/pages/CartPage';
import Checkout from '@/pages/Checkout';
import AddressBook from '@/pages/AddressBook';
import MyOrders from '@/pages/MyOrders';
import AccountProfile from '@/pages/AccountProfile';
import OrderDetail from '@/pages/OrderDetail';
import OrderSuccess from '@/pages/OrderSuccess';
import ReviewOrder from '@/pages/ReviewOrder';
import AllReviews from '@/pages/AllReviews';
import AboutPage from '@/pages/AboutPage';
import RecruitmentPage from '@/pages/RecruitmentPage';
import ReturnPolicyPage from '@/pages/ReturnPolicyPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import ShippingPolicyPage from '@/pages/ShippingPolicyPage';
import FAQPage from '@/pages/FAQPage';
import SizeGuidePage from '@/pages/SizeGuidePage';
import ScrollToTop from '@/components/ScrollToTop';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public layout (có Navbar) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/products/:productId/reviews" element={<AllReviews />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* Support both legacy and hyphenated success paths */}
          <Route path="/order/success" element={<OrderSuccess />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/addresses" element={<AddressBook />} />
          {/* Static pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route path="/return-policy" element={<ReturnPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/size-guide" element={<SizeGuidePage />} />
          {/* Account & Orders need login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders/:id/review" element={<ReviewOrder />} />
            <Route path="/account" element={<AccountProfile />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyCode />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/forgot/reset" element={<ResetPassword />} />
        </Route>

        {/* Khu vực dashboard (đã bảo vệ) — có thể dùng layout riêng nếu muốn */}
        <Route element={<ProtectedRoute />}>
          {/* First-login change password page */}
          <Route path="/first-change-password" element={<FirstLoginChangePassword />} />
          {/* Add phone after Google login */}
          <Route path="/add-phone" element={<AddPhone />} />

          {/* All other protected routes must pass through the must-change guard */}
          <Route element={<MustChangePasswordGuard />}>
            <Route element={<RoleRoute roles={['staff', 'admin']} />}>
              <Route path="/dashboard/*" element={<StaffDashboard />} />
              <Route path="/dashboard/products/new" element={<AdminProductNew />} />
            </Route>
            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
