import { useState } from 'react';
import { Link } from 'react-router-dom';
import s from './AccountModal.module.css';

const getInitial = (user) => {
  const src = user?.name || user?.username || user?.email || '';
  return (src.trim()[0] || 'U').toUpperCase();
};

export default function AccountModal({ open, onClose, user, loading, onLogout, onGotoDashboard }) {
  if (!open) return null;

  const canGoDashboard = user && ['admin', 'staff'].includes(user.role);
  const isStaffAdmin = user && ['admin', 'staff'].includes(user.role);
  const [showConfirm, setShowConfirm] = useState(false);

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
            <div className={s.loading}>
              <span className={s.spinner} aria-hidden="true" /> Đang kiểm tra đăng nhập…
            </div>
          ) : user ? (
            <>
              <div className={s.userBox}>
                <div className={s.avatarWrap}>
                  <div className={s.avatar} aria-hidden="true">
                    {getInitial(user)}
                  </div>
                </div>
                <div className={s.userMeta}>
                  {!isStaffAdmin && <div className={s.greet}>Hi khách hàng</div>}
                  <div className={s.nameRow}>
                    <div className={s.userName}>{user.name || user.username || 'Người dùng'}</div>
                    {isStaffAdmin && (
                      <span
                        className={`${s.roleBadge} ${
                          user.role === 'admin' ? s.roleAdmin : s.roleStaff
                        }`}
                      >
                        {user.role}
                      </span>
                    )}
                  </div>
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
            <div className={s.menu}>
              <Link to="/login" onClick={onClose} className={s.menuItem}>
                <span className={s.icon} aria-hidden>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
                <span>Đăng nhập</span>
                <span className={s.chev} aria-hidden>
                  ›
                </span>
              </Link>
              <Link to="/register" onClick={onClose} className={s.menuItem}>
                <span className={s.icon} aria-hidden>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span>Đăng ký</span>
                <span className={s.chev} aria-hidden>
                  ›
                </span>
              </Link>
            </div>
          ) : (
            <div className={s.menu}>
              {canGoDashboard && (
                <button className={s.menuItem} onClick={onGotoDashboard}>
                  <span className={s.icon} aria-hidden>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </span>
                  <span>Vào dashboard</span>
                  <span className={s.chev} aria-hidden>
                    ›
                  </span>
                </button>
              )}
              {!isStaffAdmin && (
                <Link to="/orders" onClick={onClose} className={s.menuItem}>
                  <span className={s.icon} aria-hidden>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H9l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span>Đơn hàng của tôi</span>
                  <span className={s.chev} aria-hidden>
                    ›
                  </span>
                </Link>
              )}
              <Link to="/account" onClick={onClose} className={s.menuItem}>
                <span className={s.icon} aria-hidden>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span>Thông tin cá nhân</span>
                <span className={s.chev} aria-hidden>
                  ›
                </span>
              </Link>
              <button className={`${s.menuItem} ${s.danger}`} onClick={() => setShowConfirm(true)}>
                <span className={s.icon} aria-hidden>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span>Đăng xuất</span>
                <span className={s.chev} aria-hidden>
                  ›
                </span>
              </button>
            </div>
          )}
        </div>
        {showConfirm && (
          <div className={s.confirmOverlay} onClick={() => setShowConfirm(false)}>
            <div
              className={s.confirmBox}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="logoutTitle"
            >
              <div className={s.confirmIcon} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 12.34a4 4 0 0 0 0 5.66l4.18 4.18a4 4 0 0 0 5.66 0l8.48-8.48a4 4 0 0 0 0-5.66l-4.18-4.18a4 4 0 0 0-5.66 0z" />
                </svg>
              </div>
              <div className={s.confirmTitle} id="logoutTitle">
                Đăng xuất tài khoản?
              </div>
              <div className={s.confirmText}>Bạn có chắc chắn muốn đăng xuất không?</div>
              <div className={s.confirmActions}>
                <button className={s.cBtnGhost} onClick={() => setShowConfirm(false)}>
                  Hủy
                </button>
                <button
                  className={s.cBtnDanger}
                  onClick={() => {
                    setShowConfirm(false);
                    onLogout();
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
