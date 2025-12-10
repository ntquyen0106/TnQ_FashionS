import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import s from './Navbar.module.css';
import { getCategories } from '@/api/category'; // <-- dùng file api/category.js bạn đã tạo
import { authApi } from '@/api/auth-api'; // <-- dùng file api/auth-api.js bạn đã tạo
import AccountModal from '@/components/AccountModal/AccountModal';
import { useAuth } from '@/auth/AuthProvider';
import { useCart } from '@/contexts/CartProvider';
import { reviewsApi } from '@/api/reviews-api';

// helper build link theo path
const P = (path) => `/products?path=${encodeURIComponent(path)}`;

const REVIEW_NOTICE_STORAGE_KEY = 'tnq_review_notice_state';
const REVIEW_NOTICE_SEEN_KEY = 'tnq_review_notice_seen_at';
const REVIEW_NOTICE_DATA_KEY = 'tnq_review_notice_data';
const REVIEW_FOCUS_PRODUCT_KEY = 'tnq_review_focus_product';
const REVIEW_NOTICE_POLL_MS = 45000;
const toTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const getLastSeenReplyAt = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage?.getItem(REVIEW_NOTICE_SEEN_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    return 0;
  }
};

const persistReviewNoticePayload = (payload) => {
  if (typeof window === 'undefined') return;
  const detail = payload || { count: 0, available: false };
  window.__tnqReviewNotifications = detail;
  if (detail.data) {
    window.__tnqReviewNotificationData = detail.data;
  } else {
    delete window.__tnqReviewNotificationData;
  }
  try {
    window.localStorage?.setItem(REVIEW_NOTICE_STORAGE_KEY, JSON.stringify(detail));
    if (detail.data) {
      window.localStorage?.setItem(REVIEW_NOTICE_DATA_KEY, JSON.stringify(detail.data));
    } else {
      window.localStorage?.removeItem(REVIEW_NOTICE_DATA_KEY);
    }
  } catch (err) {}
  window.dispatchEvent(new CustomEvent('tnq-review-notifications', { detail }));
};

const buildReviewNoticePayload = (reviews = []) => {
  if (!Array.isArray(reviews) || !reviews.length) {
    return { count: 0, available: false };
  }
  const notifications = [];
  reviews.forEach((review) => {
    const replies = Array.isArray(review.replies) ? review.replies : [];
    if (!replies.length) return;
    const products = Array.isArray(review.products) ? review.products : [];
    const match = products.find((item) => {
      const pid = item?.productId?._id || item?.productId;
      return pid && review.productId && String(pid) === String(review.productId);
    });
    const productName = match?.productName || match?.name || 'Sản phẩm';
    const variantSku = review.variantSku || match?.variantSku || '';
    replies.forEach((reply) => {
      notifications.push({
        id: `${review._id}-${reply._id || toTimestamp(reply.createdAt)}`,
        productKey: String(review.productId || review._id || reply._id),
        productName,
        variantSku,
        reply,
        orderId: review.orderId,
        orderCode: review.orderCode || review.orderId,
      });
    });
  });
  if (!notifications.length) {
    return { count: 0, available: false };
  }
  notifications.sort((a, b) => toTimestamp(b.reply?.createdAt) - toTimestamp(a.reply?.createdAt));
  const latestReplyAt = toTimestamp(notifications[0].reply?.createdAt);
  const lastSeen = getLastSeenReplyAt();
  const unread = notifications.filter((item) => toTimestamp(item.reply?.createdAt) > lastSeen);
  const payload = {
    count: unread.length,
    available: unread.length > 0,
    data: {
      notifications,
      latestReplyAt,
      total: notifications.length,
    },
  };
  return payload;
};

const parseReviewNotice = (detail) => {
  const count = Number(detail?.count) || 0;
  return {
    count,
    available: Boolean(detail?.available && count > 0),
  };
};

const readStoredReviewNotice = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(REVIEW_NOTICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

const readStoredReviewData = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(REVIEW_NOTICE_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

const sanitizeReviewData = (data) => {
  if (!data) return null;
  const list = Array.isArray(data.notifications) ? data.notifications.filter(Boolean) : [];
  if (!list.length) return null;
  return {
    ...data,
    notifications: list.map((item) => ({
      id: item.id,
      productKey: item.productKey,
      productName: item.productName,
      variantSku: item.variantSku,
      reply: item.reply,
      orderId: item.orderId,
      orderCode: item.orderCode,
    })),
  };
};

const formatReplyTime = (value) => {
  if (!value) return 'Vừa xong';
  try {
    return new Date(value).toLocaleString('vi-VN', { hour12: false });
  } catch (err) {
    return 'Vừa xong';
  }
};

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

function IconBell(props) {
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
        d="M6 9a6 6 0 0 1 12 0c0 3 1 4.5 2 6H4c1-1.5 2-3 2-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 19a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.8" />
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
  const [reviewNotice, setReviewNotice] = useState({ count: 0, available: false });
  const [reviewNoticeData, setReviewNoticeData] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

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

  const normalizeText = (str = '') =>
    String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const findCategoryMatch = (keyword) => {
    if (!keyword || !Array.isArray(tree)) return null;
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return null;

    const matches = [];
    const visit = (nodes = []) => {
      nodes.forEach((node) => {
        const nameNorm = normalizeText(node.name);
        const wordMatch = nameNorm
          ? nameNorm
              .split(' ')
              .filter(Boolean)
              .every((word) => normalizedKeyword.includes(word))
          : false;
        if (
          nameNorm &&
          (normalizedKeyword.includes(nameNorm) ||
            nameNorm.includes(normalizedKeyword) ||
            wordMatch)
        ) {
          matches.push(node);
        }
        if (Array.isArray(node.children) && node.children.length) visit(node.children);
      });
    };
    visit(tree);
    if (!matches.length) return null;
    matches.sort((a, b) => normalizeText(a.name).length - normalizeText(b.name).length);
    return matches[0];
  };

  // Navbar reads `user` and `loading` from AuthProvider. No direct /auth/me call here to avoid duplicate requests.

  // ESC để đóng modal
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setShowAccount(false);
    if (showAccount) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAccount]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const applyDetail = (detail) => {
      setReviewNotice(parseReviewNotice(detail));
      if (detail?.data) {
        setReviewNoticeData(sanitizeReviewData(detail.data));
      }
    };
    const applyData = (data) => {
      setReviewNoticeData(sanitizeReviewData(data));
    };
    const handler = (event) => applyDetail(event.detail);
    const handleStorage = (event) => {
      if (event.key === REVIEW_NOTICE_STORAGE_KEY) {
        try {
          applyDetail(event.newValue ? JSON.parse(event.newValue) : null);
        } catch (err) {
          applyDetail(null);
        }
      }
      if (event.key === REVIEW_NOTICE_DATA_KEY) {
        try {
          applyData(event.newValue ? JSON.parse(event.newValue) : null);
        } catch (err) {
          applyData(null);
        }
      }
    };

    const initialDetail = window.__tnqReviewNotifications || readStoredReviewNotice();
    applyDetail(initialDetail);
    if (initialDetail?.data) {
      applyData(initialDetail.data);
    } else {
      const storedData = window.__tnqReviewNotificationData || readStoredReviewData();
      applyData(storedData);
    }

    window.addEventListener('tnq-review-notifications', handler);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('tnq-review-notifications', handler);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detail = window.__tnqReviewNotifications || readStoredReviewNotice();
    const parsed = parseReviewNotice(detail);
    setReviewNotice(parsed);
    if (detail?.data) {
      setReviewNoticeData(sanitizeReviewData(detail.data));
    } else {
      const storedData = window.__tnqReviewNotificationData || readStoredReviewData();
      setReviewNoticeData(sanitizeReviewData(storedData));
    }
  }, [location.pathname]);

  useEffect(() => {
    setReviewModalOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!reviewModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setReviewModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reviewModalOpen]);

  useEffect(() => {
    if (!reviewModalOpen) return;
    if (typeof window === 'undefined') return;
    if (!reviewNoticeData?.latestReplyAt) return;
    try {
      window.localStorage?.setItem(REVIEW_NOTICE_SEEN_KEY, String(reviewNoticeData.latestReplyAt));
    } catch (err) {}
    const nextDetail = {
      count: 0,
      available: false,
      data: reviewNoticeData,
    };
    persistReviewNoticePayload(nextDetail);
  }, [reviewModalOpen, reviewNoticeData]);

  const reviewPollTimerRef = useRef(null);

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      persistReviewNoticePayload({ count: 0, available: false });
      return undefined;
    }
    if (user.role === 'admin' || user.role === 'staff') return undefined;

    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const res = await reviewsApi.mine();
        if (cancelled) return;
        const list = Array.isArray(res?.reviews) ? res.reviews : res || [];
        const payload = buildReviewNoticePayload(list);
        persistReviewNoticePayload(payload);
      } catch (err) {
        if (!cancelled) console.error('load review notifications failed', err);
      } finally {
        if (!cancelled) {
          reviewPollTimerRef.current = setTimeout(fetchNotifications, REVIEW_NOTICE_POLL_MS);
        }
      }
    };

    fetchNotifications();

    return () => {
      cancelled = true;
      if (reviewPollTimerRef.current) {
        clearTimeout(reviewPollTimerRef.current);
        reviewPollTimerRef.current = null;
      }
    };
  }, [user?._id, loading]);

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

  const onSearch = (e) => {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    const matchedCategory = findCategoryMatch(value);
    if (matchedCategory?.path) {
      nav(P(matchedCategory.path));
      return;
    }
    nav(`/products?q=${encodeURIComponent(value)}`);
  };

  const staleInfo = cart?.staleInfo;
  const staleItems = Array.isArray(staleInfo?.items) ? staleInfo.items : [];
  const hasStale = Boolean(staleInfo?.hasStale && staleItems.length);
  const hasUrgent = hasStale && staleItems.some((it) => it.level === 'urgent');
  const reminderLevel = hasStale ? (hasUrgent ? 'hard' : 'soft') : null;
  const staleMessage = hasStale
    ? hasUrgent
      ? `Bạn đã quên ${staleItems.length} sản phẩm này rồi sao, hãy thanh toán ngay !` // HARD
      : `Giỏ hàng đang có ${staleItems.length} sản phẩm chờ bạn thanh toán !` // SOFT
    : '';

  const cartAriaLabel = hasStale ? `Giỏ hàng - ${staleItems.length} sản phẩm đang chờ` : 'Giỏ hàng';
  const reminderClass =
    reminderLevel === 'hard' ? s.cartNoticeHard : reminderLevel === 'soft' ? s.cartNoticeSoft : '';

  const DISMISS_KEY = 'tnq_cart_reminder_dismissed_at';
  const DISMISS_DURATION_MS = 3000; // 30 seconds

  // Initialize showReminder based on localStorage
  const [showReminder, setShowReminder] = useState(() => {
    // Check if we're on cart or checkout page
    const currentPath = window.location.pathname;
    if (currentPath === '/cart' || currentPath === '/checkout') return false;

    // Check if there's a valid dismissal timestamp
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt) {
        const elapsed = Date.now() - dismissedAt;
        // If still within dismiss period, hide
        if (elapsed < DISMISS_DURATION_MS) {
          return false;
        }
        // If expired, clean up and show
        localStorage.removeItem(DISMISS_KEY);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return true;
  });

  const dismissTimerRef = useRef(null);

  useEffect(() => {
    // Clear any existing timer first
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    // Nếu đang ở trang giỏ hàng hoặc checkout thì luôn ẩn
    if (location.pathname === '/cart' || location.pathname === '/checkout') {
      setShowReminder(false);
      return;
    }

    // Nếu hiện tại không có stale thì chỉ ẩn, KHÔNG xoá DISMISS_KEY
    if (!hasStale) {
      setShowReminder(false);
      return;
    }

    // Check persistent dismissal timestamp (so it survives reload)
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    } catch (e) {
      dismissedAt = 0;
    }

    const now = Date.now();
    const elapsed = dismissedAt ? now - dismissedAt : Infinity;

    if (dismissedAt && elapsed < DISMISS_DURATION_MS) {
      // vẫn trong thời gian “để sau” → ẩn, set timer chờ hết hạn
      setShowReminder(false);
      const remaining = DISMISS_DURATION_MS - elapsed;
      dismissTimerRef.current = setTimeout(() => {
        const currentPath = window.location.pathname;
        if (hasStale && currentPath !== '/cart' && currentPath !== '/checkout') {
          setShowReminder(true);
          try {
            localStorage.removeItem(DISMISS_KEY);
          } catch (e) {}
        }
      }, remaining);
    } else {
      // hết hạn hoặc chưa từng dismiss → hiện
      setShowReminder(true);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch (e) {}
    }
  }, [hasStale, staleItems.length, location.pathname]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleCheckout = () => {
    setShowReminder(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch (e) {}
    nav('/cart');
  };

  const handleDismiss = () => {
    setShowReminder(false);
    // persist dismissal timestamp so it survives reloads
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {}

    // Clear existing timer if any
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    // Set timer to re-show after 30 seconds
    dismissTimerRef.current = setTimeout(() => {
      const currentPath = window.location.pathname;
      if (hasStale && currentPath !== '/cart' && currentPath !== '/checkout') {
        setShowReminder(true);
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch (e) {}
      }
    }, DISMISS_DURATION_MS);
  };

  const hasReviewNotice = reviewNotice.count > 0;
  const hasReviewModalItems = Boolean(reviewNoticeData?.notifications?.length);
  const reviewBellLabel = hasReviewNotice
    ? `Xem ${reviewNotice.count} phản hồi từ cửa hàng`
    : 'Chưa có phản hồi mới';

  const gotoDashboard = () => {
    if (!user) return;
    if (user.role === 'admin') return nav('/dashboard/admin');
    if (user.role === 'staff') return nav('/dashboard');
    return nav('/'); // hoặc '/account' nếu bạn muốn
  };

  const onReviewPage = /^\/orders\/[^/]+\/review$/.test(location.pathname);

  const openReviewNotifications = () => {
    if (!reviewNotice.available) return;
    if (onReviewPage && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tnq-open-review-notifications'));
      return;
    }
    if (reviewNoticeData?.notifications?.length) {
      setReviewModalOpen(true);
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tnq-open-review-notifications'));
    }
  };

  const handleGlobalNotificationClick = (notification) => {
    if (!notification?.orderId) return;
    try {
      window.localStorage?.setItem(
        REVIEW_FOCUS_PRODUCT_KEY,
        JSON.stringify({ productKey: notification.productKey || '' }),
      );
    } catch (err) {}
    setReviewModalOpen(false);
    nav(`/orders/${notification.orderId}/review`);
  };

  const closeReviewModal = () => setReviewModalOpen(false);

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

          {/* Chuông thông báo phản hồi đánh giá */}
          <button
            type="button"
            className={`${s.icon} ${!reviewNotice.available ? s.iconMuted : ''}`.trim()}
            onClick={openReviewNotifications}
            aria-label={reviewBellLabel}
            aria-disabled={!reviewNotice.available}
            aria-haspopup="dialog"
            aria-expanded={reviewModalOpen}
            aria-controls={reviewModalOpen ? 'review-notification-modal' : undefined}
          >
            <IconBell />
            {hasReviewNotice && (
              <span className={s.badge}>
                {reviewNotice.count > 99 ? '99+' : reviewNotice.count}
              </span>
            )}
          </button>

          {showCart && (
            <div className={s.cartWrap}>
              <Link to="/cart" className={s.icon} aria-label={cartAriaLabel}>
                <IconCart />
                {cartQty > 0 && (
                  <span className={s.badge} aria-live="polite">
                    {cartQty}
                  </span>
                )}
              </Link>
              {hasStale && showReminder && (
                <div
                  className={`${s.cartNotice} ${reminderClass}`}
                  role="status"
                  aria-live="polite"
                >
                  <span>{staleMessage}</span>
                  <div className={s.cartNoticeActions}>
                    <button
                      className={`${s.cartNoticeBtn} ${s.cartNoticePrimary}`}
                      onClick={handleCheckout}
                    >
                      Thanh toán
                    </button>
                    <button
                      className={`${s.cartNoticeBtn} ${s.cartNoticeSecondary}`}
                      onClick={handleDismiss}
                    >
                      Để sau
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {reviewModalOpen && hasReviewModalItems && (
        <div
          className={s.reviewOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-notice-title"
          id="review-notification-modal"
          onClick={closeReviewModal}
        >
          <div className={s.reviewModal} onClick={(e) => e.stopPropagation()}>
            <div className={s.reviewHead}>
              <div>
                <p id="review-notice-title" className={s.reviewTitle}>
                  Phản hồi từ TNQ Fashion
                </p>
                <span className={s.reviewSubtitle}>
                  {reviewNoticeData.notifications.length === 1
                    ? '1 phản hồi mới'
                    : `${reviewNoticeData.notifications.length} phản hồi từ cửa hàng`}
                </span>
              </div>
              <button
                type="button"
                className={s.reviewClose}
                onClick={closeReviewModal}
                aria-label="Đóng thông báo"
              >
                ✕
              </button>
            </div>
            <div className={s.reviewList}>
              {reviewNoticeData.notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={s.reviewItem}
                  onClick={() => handleGlobalNotificationClick(notification)}
                >
                  <div className={s.reviewMeta}>
                    <p>{notification.productName || 'Sản phẩm'}</p>
                    {notification.variantSku && <span>{notification.variantSku}</span>}
                  </div>
                  <p className={s.reviewPreview}>
                    {notification.reply?.comment || 'Shop đã phản hồi đơn hàng của bạn.'}
                  </p>
                  <span className={s.reviewTime}>
                    {formatReplyTime(notification.reply?.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
