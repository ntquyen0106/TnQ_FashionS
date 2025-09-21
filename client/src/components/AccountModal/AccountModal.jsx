import { Link } from 'react-router-dom';
import s from './AccountModal.module.css';

const getInitial = (user) => {
  const src = user?.name || user?.username || user?.email || '';
  return (src.trim()[0] || 'U').toUpperCase();
};

export default function AccountModal({ open, onClose, user, loading, onLogout, onGotoDashboard }) {
  if (!open) return null;

  const canGoDashboard = user && ['admin', 'staff'].includes(user.role);

  return (
    <div className={s.overlay} onClick={onClose} aria-modal="true">
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tài khoản"
      >
        <div className={s.header}>
          <div className={s.title}>Tài khoản</div>
          <button className={s.close} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <div className={s.body}>
          {loading ? (
            <div className={s.loading}>Đang kiểm tra đăng nhập…</div>
          ) : user ? (
            <>
              <div className={s.userBox}>
                <div className={s.avatar} aria-hidden="true">
                  {getInitial(user)}
                </div>
                <div className={s.userMeta}>
                  <div className={s.userName}>{user.name || user.username || 'Người dùng'}</div>
                  {user.email && <div className={s.userEmail}>{user.email}</div>}
                  {user.role && <span className={s.roleBadge}>{user.role}</span>}
                </div>
              </div>
              <div className={s.hr} />
            </>
          ) : (
            <div className={s.empty}>Bạn chưa đăng nhập.</div>
          )}
        </div>

        <div className={s.actions}>
          {!user ? (
            <>
              <Link to="/login" onClick={onClose} className={s.btnPrimary}>
                Đăng nhập
              </Link>
              <Link to="/register" onClick={onClose} className={s.btn}>
                Đăng ký
              </Link>
            </>
          ) : (
            <>
              {/* Chỉ hiện khi admin/staff */}
              {canGoDashboard && (
                <button className={s.btn} onClick={onGotoDashboard}>
                  Vào dashboard
                </button>
              )}
              <Link to="/account" onClick={onClose} className={s.btn}>
                Trang cá nhân
              </Link>
              <button className={s.btnDanger} onClick={onLogout}>
                Đăng xuất
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
