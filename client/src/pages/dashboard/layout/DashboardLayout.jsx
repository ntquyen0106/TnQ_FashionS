import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import Navbar from '@/components/Navbar'; // <-- dùng lại Navbar có modal tài khoản
import { useEffect, useState } from 'react';
import { attendanceApi } from '@/api/attendance-api';
import ConfirmModal from '@/components/ConfirmModal';

export default function DashboardLayout({ links = [] }) {
  const { user } = useAuth();
  const [att, setAtt] = useState({
    withinShift: false,
    checkedIn: false,
    canCheckIn: false,
    canCheckOut: false,
    shift: null,
  });
  const [confirm, setConfirm] = useState({ open: false, action: null }); // action: 'in' | 'out'
  const [pending, setPending] = useState(false);

  const refreshStatus = async () => {
    if (user?.role !== 'staff') return; // only staff tracks attendance
    try {
      const data = await attendanceApi.myStatus();
      setAtt(data || {});
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

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
            {links.map((l) => {
              // Lock when staff is outside shift OR has checked out (i.e., not checkedIn)
              const locked = user?.role === 'staff' && (!att.withinShift || !att.checkedIn);
              const allowed = ['/dashboard/my-shifts', '/dashboard/stats'];
              const disabled = locked && !allowed.includes(l.to);
              return (
                <NavLink
                  key={l.to}
                  to={disabled ? '#' : l.to}
                  onClick={(e) => {
                    if (disabled) e.preventDefault();
                  }}
                  end
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: disabled ? '#999' : isActive ? '#fff' : '#111',
                    background: isActive ? '#111' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    opacity: disabled ? 0.6 : 1,
                  })}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {l.icon && <span style={{ fontSize: 18 }}>{l.icon}</span>}
                    <span>{l.label}</span>
                  </span>
                  {typeof l.badge === 'number' && l.badge > 0 && (
                    <span
                      style={{
                        background: '#ff4d4f',
                        color: '#fff',
                        borderRadius: 999,
                        minWidth: 24,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                    >
                      {l.badge > 99 ? '99+' : l.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {user?.role === 'staff' && (
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #eee',
                borderRadius: 8,
                padding: 12,
                marginTop: 16, // place below chat/navigation to avoid accidental clicks
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Chấm công</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!att.checkedIn ? (
                  <button
                    className="btn"
                    onClick={() => setConfirm({ open: true, action: 'in' })}
                    disabled={!att.canCheckIn && !att.withinShift}
                    title={!att.withinShift ? 'Chỉ có thể check in trong giờ ca' : 'Check in'}
                  >
                    Check in
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => setConfirm({ open: true, action: 'out' })}
                    disabled={!att.canCheckOut}
                    title={!att.canCheckOut ? 'Bạn chưa check in' : 'Check out'}
                  >
                    Check out
                  </button>
                )}
              </div>
              <div style={{ marginTop: 6, color: '#555', fontSize: 12 }}>
                {att.withinShift ? 'Trong ca' : 'Ngoài ca'}{' '}
                {att.checkedIn ? '· Đã check in' : '· Đã check out hoặc chưa check in'}
              </div>
            </div>
          )}
        </aside>

        {/* Nội dung */}
        <main style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.action === 'in' ? 'Xác nhận check in' : 'Xác nhận check out'}
        message={
          confirm.action === 'in'
            ? 'Bạn có chắc muốn check in vào ca hiện tại?'
            : 'Bạn có chắc muốn check out và kết thúc ca hiện tại?'
        }
        confirmText={confirm.action === 'in' ? 'Check in' : 'Check out'}
        cancelText="Hủy"
        onCancel={() => setConfirm({ open: false, action: null })}
        onConfirm={async () => {
          if (!confirm.action) return;
          setPending(true);
          try {
            if (confirm.action === 'in') await attendanceApi.checkIn();
            else await attendanceApi.checkOut(att?.shift?._id);
            await refreshStatus();
          } catch (e) {
            // optional: could show a toast; keep modal just closing
          } finally {
            setPending(false);
            setConfirm({ open: false, action: null });
          }
        }}
        disabled={pending}
      />
    </>
  );
}
