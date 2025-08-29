import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Products from './pages/Products';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyCode from './pages/VerifyCode';
import Forgot from './pages/Forgot';
import ResetPassword from './pages/ResetPassword';
import { useAuth } from './auth/AuthProvider'; // dùng context, KHÔNG dùng localStorage
import { ProtectedRoute, RoleRoute } from './auth/guards';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import StaffDashboard from './pages/dashboard/StaffDashboard';

function Navbar() {
  const nav = useNavigate();
  const { user, logout } = useAuth(); // lấy sẵn hàm logout từ context

  const handleLogout = async () => {
    // <- định nghĩa HÀM NÀY
    await logout(); // gọi API /auth/logout trong AuthProvider
    nav('/login'); // điều hướng sau khi logout
  };

  return (
    <nav className="nav">
      <div className="container" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div className="brand">
          <Link to="/">TnQ Fashion</Link>
        </div>
        <div className="nav-links" style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <Link to="/">Trang chủ</Link>
          <Link to="/products">Sản phẩm</Link>
          {user && (user.role === 'admin' || user.role === 'staff') && (
            <Link to={user.role === 'admin' ? '/dashboard/admin' : '/dashboard'}>Dashboard</Link>
          )}

          {user ? (
            <>
              <span>Xin chào, {user.name || user.email}</span>
              <button onClick={handleLogout} className="btn">
                Đăng xuất
              </button>
            </>
          ) : (
            <Link to="/login">Đăng nhập</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyCode />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/forgot/reset" element={<ResetPassword />} />

        {/* Bảo vệ tất cả dashboard */}
        <Route element={<ProtectedRoute />}>
          {/* staff + admin được vào /dashboard */}
          <Route element={<RoleRoute roles={['staff', 'admin']} />}>
            <Route path="/dashboard/*" element={<StaffDashboard />} />
          </Route>
          {/* chỉ admin mới vào /dashboard/admin */}
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
