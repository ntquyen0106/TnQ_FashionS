import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import Navbar from '@/components/Navbar'; // <-- dùng lại Navbar có modal tài khoản

export default function DashboardLayout({ links = [] }) {
  const { user } = useAuth();

  return (
    <>
      {/* Topbar: ẩn mega menu, thu gọn; muốn ẩn search/cart thì thêm showActions={false} */}
      <Navbar hideMenu compact showSearch={false} showCart={false} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          height: 'calc(100vh - 64px)', // cố định chiều cao phần dưới Navbar
          overflow: 'hidden', // chỉ cho phần nội dung scroll
          background: '#fafafa',
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            borderRight: '1px solid #eee',
            padding: 16,
            background: '#fff',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: 20,
              fontSize: 16,
              textAlign: 'center',
              background: 'linear-gradient(90deg, #111 60%, #444 100%)',
              color: '#fff',
              borderRadius: 10,
              padding: '7px 0',
              boxShadow: '0 2px 8px 0 rgba(0,0,0,0.07)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              width: '100%',
              maxWidth: 180,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {user?.role === 'admin' ? 'Admin' : 'Staff'} panel
          </div>

          <nav style={{ display: 'grid', gap: 6 }}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '10px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#111',
                  background: isActive ? '#111' : 'transparent',
                })}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Nội dung */}
        <main style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
