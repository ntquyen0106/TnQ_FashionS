import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Products from './pages/Products';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyCode from './pages/VerifyCode';
import Forgot from './pages/Forgot';
import ResetPassword from './pages/ResetPassword';
import { ProtectedRoute, RoleRoute } from './auth/guards';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public layout (có Navbar) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/success" element={<OrderSuccess />} />
          <Route path="/addresses" element={<AddressBook />} />
          {/* Account & Orders need login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
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
          <Route element={<RoleRoute roles={['staff', 'admin']} />}>
            <Route path="/dashboard/*" element={<StaffDashboard />} />
            <Route path="/dashboard/products/new" element={<AdminProductNew />} />
          </Route>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
