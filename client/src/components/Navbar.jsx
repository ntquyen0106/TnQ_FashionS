import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import s from './Navbar.module.css';
import { getCategories } from '@/api/category'; // <-- dùng file api/category.js bạn đã tạo
import { authApi } from '@/api/auth-api'; // <-- dùng file api/auth-api.js bạn đã tạo
import AccountModal from '@/components/AccountModal/AccountModal';
import { useAuth } from '@/auth/AuthProvider';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const LOGO_ID = 'ChatGPT_Image_22_23_22_17_thg_9_2025_hhh7c9'; // đổi thành publicId logo của bạn
const logoUrl = CLOUD
  ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,h_40/${LOGO_ID}`
  : '';

// helper build link theo path
const P = (path) => `/products?path=${encodeURIComponent(path)}`;

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
  const [q, setQ] = useState('');

  // ====== NEW: lấy danh mục từ API ======
  const [tree, setTree] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);

  const { user, setUser } = useAuth();
  const [loadingMe, setLoadingMe] = useState(true);
  const [showAccount, setShowAccount] = useState(false);

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

  // lấy user từ authApi cũ của bạn
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await authApi.me();
        if (alive) setUser(me || null);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
        <Link to="/" className={s.brand} aria-label="TnQ Fashion">
          {logoUrl ? <img src={logoUrl} alt="TnQ Fashion" /> : <strong>TnQ</strong>}
        </Link>

        {/* Menu (ẩn nếu muốn dùng trên dashboard) */}
        {!hideMenu && (
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
                                {col.items?.length ? (
                                  col.items.map((it) => (
                                    <li key={it.to}>
                                      <Link to={it.to} className={s.colLink}>
                                        {it.label}
                                      </Link>
                                    </li>
                                  ))
                                ) : (
                                  <li style={{ color: '#999' }}>Đang cập nhật…</li>
                                )}
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
                🔍
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
            👤
          </button>
          {showCart && (
            <Link to="/cart" className={s.icon} aria-label="Giỏ hàng">
              🛍️<span className={s.badge}>0</span>
            </Link>
          )}
        </div>
      </div>

      {/* Modal tách riêng */}
      <AccountModal
        open={showAccount}
        onClose={() => setShowAccount(false)}
        user={user}
        loading={loadingMe}
        onLogout={doLogout}
        onGotoDashboard={gotoDashboard}
      />
    </header>
  );
}
