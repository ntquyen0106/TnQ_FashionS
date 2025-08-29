import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';

const linkStyle = (active) => ({
  display: 'block',
  padding: '10px 12px',
  borderRadius: 8,
  textDecoration: 'none',
  color: active ? '#fff' : '#111',
  background: active ? '#111' : 'transparent',
});

export default function DashboardLayout({ links }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 'calc(100vh - 60px)' }}
    >
      {/* Sidebar */}
      <aside style={{ borderRight: '1px solid #eee', padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          {user?.role === 'admin' ? 'Admin' : 'Staff'} panel
        </div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {links.map((l) => (
            <Link key={l.to} to={l.to} style={linkStyle(pathname === l.to)}>
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      {/* Content */}
      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
