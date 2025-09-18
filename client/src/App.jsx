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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public layout (có Navbar) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
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
