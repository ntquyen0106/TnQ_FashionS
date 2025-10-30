import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import s from './Navbar.module.css';
import { getCategories } from '@/api/category'; // <-- dùng file api/category.js bạn đã tạo
import { authApi } from '@/api/auth-api'; // <-- dùng file api/auth-api.js bạn đã tạo
import AccountModal from '@/components/AccountModal/AccountModal';
import { useAuth } from '@/auth/AuthProvider';
import { useCart } from '@/contexts/CartProvider';

// helper build link theo path
const P = (path) => `/products?path=${encodeURIComponent(path)}`;

// --- Inline SVG icons (stroke inherits currentColor) ---
function IconUser(props) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 19.5c0-4.1421 3.3579-7.5 7.5-7.5h1c4.1421 0 7.5 3.3579 7.5 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCart(props) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 4h2l1.6 9.2a2 2 0 0 0 2 1.8h7.9a2 2 0 0 0 1.9-1.4L21 7H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="19" r="1.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconSearch(props) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// tìm node theo path trong cây category
const findByPath = (nodes, path) => {
  for (const n of nodes) {
    if (n.path === path) return n;
    const f = findByPath(n.children || [], path);
    if (f) return f;
  }
  return null;
};

// chuyển children của 1 node thành mảng link {label, to}
const toLinks = (node) => (node?.children || []).map((c) => ({ label: c.name, to: P(c.path) }));

export default function Navbar({
  hideMenu = false,
  compact = false,
  showSearch = true,
  showCart = true,
}) {
  const nav = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');

  // ====== NEW: lấy danh mục từ API ======
  const [tree, setTree] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);

  const { user, setUser, loading } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const { cart } = useCart();

  const isDashboard = location.pathname.startsWith('/dashboard');
  const isStaffOrAdmin = user && (user.role === 'staff' || user.role === 'admin');

  const cartQty = useMemo(() => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const total = items.reduce((s, it) => s + (Number(it.qty) || 1), 0);
    return total > 99 ? 99 : total; // cap hiển thị 99+
  }, [cart]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getCategories({ status: 'active', asTree: 1 });
        if (mounted) setTree(data || []);
      } catch (e) {
        console.error('load categories failed:', e);
        if (mounted) setTree([]);
      } finally {
        if (mounted) setLoadingCats(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  // Navbar reads `user` and `loading` from AuthProvider. No direct /auth/me call here to avoid duplicate requests.

  // ESC để đóng modal
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setShowAccount(false);
    if (showAccount) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAccount]);

  const MENU = useMemo(() => {
    if (!tree || !tree.length) return [];

    return tree.map((root) => {
      return {
        label: root.name.toUpperCase(),
        type: root.children?.length ? 'mega' : 'link',
        to: P(root.path),
        columns: root.children?.length
          ? root.children.map((child) => ({
              title: child.name,
              to: P(child.path),
              items: toLinks(child),
            }))
          : [],
      };
    });
  }, [tree]);

  // search
  const onSearch = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (v) nav(`/products?q=${encodeURIComponent(v)}`);
  };

  const gotoDashboard = () => {
    if (!user) return;
    if (user.role === 'admin') return nav('/dashboard/admin');
    if (user.role === 'staff') return nav('/dashboard');
    return nav('/'); // hoặc '/account' nếu bạn muốn
  };

  const doLogout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      setShowAccount(false);
      nav('/');
    } catch (e) {
      alert('Đăng xuất lỗi: ' + e.message);
    }
  };

  return (
    <header className={`${s.wrap} ${compact ? s.compact : ''}`}>
      <div className={`container ${s.inner}`}>
        {/* Logo */}
        <Link to="/" className={s.brand} aria-label="TNQ Fashion">
          <span className={s.logoPrimary}>TNQ</span>
          <span className={s.logoSecondary}>Fashion</span>
        </Link>

        {/* Center role/name for staff/admin */}
        <div className={s.centerInfo} aria-live="polite">
          {isStaffOrAdmin && isDashboard ? (
            <span className={s.roleBadge}>
              {user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}: {user.name || user.email}
            </span>
          ) : null}
        </div>

        {/* Menu (ẩn nếu muốn dùng trên dashboard) */}
        {!isDashboard && !hideMenu && (
          <nav className={s.nav} aria-label="Main">
            <ul className={s.menu}>
              {loadingCats && (
                <li className={s.link} style={{ opacity: 0.5 }}>
                  Đang tải…
                </li>
              )}
              {!loadingCats &&
                MENU.map((m) => (
                  <li key={m.label} className={`${s.item} ${m.type === 'mega' ? s.hasMega : ''}`}>
                    <Link to={m.to} className={s.link}>
                      {m.label}
                    </Link>
                    {m.type === 'mega' && (
                      <div className={s.mega} role="region" aria-label={`Danh mục ${m.label}`}>
                        <div className={`container ${s.megaInner}`}>
                          {m.columns.map((col) => (
                            <div className={s.col} key={col.title}>
                              <Link to={col.to} className={s.colTitle}>
                                {col.title}
                              </Link>
                              <ul className={s.colList}>
                                {col.items?.length
                                  ? col.items.map((it) => (
                                      <li key={it.to}>
                                        <Link to={it.to} className={s.colLink}>
                                          {it.label}
                                        </Link>
                                      </li>
                                    ))
                                  : null}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </nav>
        )}

        {/* Search + icons */}
        <div className={s.actions}>
          {showSearch && (
            <form onSubmit={onSearch} className={s.search}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm..."
                aria-label="Tìm kiếm"
              />
              <button type="submit" aria-label="Tìm kiếm">
                <IconSearch />
              </button>
            </form>
          )}

          {/* Nút mở modal tài khoản */}
          <button
            type="button"
            className={s.icon}
            aria-label="Tài khoản"
            onClick={() => setShowAccount(true)}
          >
            <IconUser />
          </button>
          {showCart && (
            <Link to="/cart" className={s.icon} aria-label="Giỏ hàng">
              <IconCart />
              {cartQty > 0 && (
                <span className={s.badge} aria-live="polite">
                  {cartQty}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Modal tách riêng */}
      <AccountModal
        open={showAccount}
        onClose={() => setShowAccount(false)}
        user={user}
        loading={loading}
        onLogout={doLogout}
        onGotoDashboard={gotoDashboard}
      />
    </header>
  );
}
