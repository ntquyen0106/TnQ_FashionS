import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api/auth-api';
import { loginWithGoogle, loginWithFacebook } from '../api/firebase';
import { useAuth } from '../auth/AuthProvider';
import styles from './LoginRegister.module.css';

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth(); // <-- dùng context
  const [identifier, setIdentifier] = useState(''); // email hoặc SĐT
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const fromPath = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);

    try {
      await authApi.login({ identifier, password, remember: true });

      // Đợi cookie được set rồi mới gọi me(); retry nhẹ nếu cần
      let me = null;
      for (let i = 0; i < 2 && !me; i++) {
        try {
          me = await authApi.me();
        } catch {
          await new Promise((r) => setTimeout(r, 120)); // chờ 120ms rồi thử lại 1 lần
        }
      }

      if (me) setUser(me);

      // Nếu cần đổi mật khẩu lần đầu, đưa đến trang đổi mật khẩu ngay
      if (me?.mustChangePassword) {
        nav('/first-change-password', { replace: true });
      } else {
        // Điều hướng theo role (nếu me chưa về kịp thì coi như user thường)
        if (me?.role === 'admin') nav('/dashboard/admin', { replace: true });
        else if (me?.role === 'staff') nav('/dashboard', { replace: true });
        else {
          // Nếu đến từ cart với selectedIds, giữ nguyên state khi quay về checkout
          if (fromPath === '/checkout' && location.state?.selectedIds) {
            nav('/checkout', { replace: true, state: { selectedIds: location.state.selectedIds } });
          } else {
            nav(fromPath, { replace: true });
          }
        }
      }
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  // --- Google ---
  const handleGoogleLogin = async () => {
    try {
      setMsg('');
      setLoading(true);
      const result = await loginWithGoogle();
      const idToken = await result.user.getIdToken();

      // Server may respond with { user, requiresPhone }
      const data = await authApi.firebaseLogin(idToken);

      setUser(data?.user || null);
      if (data?.requiresPhone) {
        // Chuyển đến luồng thêm SĐT sau khi login bằng Google
        nav('/add-phone', { replace: true });
      } else {
        // Kiểm tra xem có cần quay về checkout với selectedIds không
        if (fromPath === '/checkout' && location.state?.selectedIds) {
          nav('/checkout', { replace: true, state: { selectedIds: location.state.selectedIds } });
        } else {
          nav(fromPath, { replace: true });
        }
      }
    } catch (err) {
      console.error(err);
      setMsg('Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  // --- Facebook ---
  const handleFacebookLogin = async () => {
    try {
      setMsg('');
      setLoading(true);
      const result = await loginWithFacebook();
      const idToken = await result.user.getIdToken(); // nếu provider không có idToken, hãy ẩn nút FB
      const { data } = await authApi.firebaseLogin(idToken);
      setUser(data.user);
      // Kiểm tra xem có cần quay về checkout với selectedIds không
      if (fromPath === '/checkout' && location.state?.selectedIds) {
        nav('/checkout', { replace: true, state: { selectedIds: location.state.selectedIds } });
      } else {
        nav(fromPath, { replace: true });
      }
    } catch (err) {
      console.error(err);
      setMsg('Đăng nhập Facebook thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => nav('/')}
          aria-label="Đóng"
        >
          ✕
        </button>
        <h2 className={styles.h1}>Đăng nhập</h2>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email hoặc SĐT</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>@</span>
              <input
                className={styles.input}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com hoặc 09xxxxxxxx"
                type="text"
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
            <Link className={styles.link} to="/register">
              Chưa có tài khoản? Đăng ký
            </Link>
            <Link className={styles.link} to="/forgot" style={{ marginLeft: 10 }}>
              Quên mật khẩu?
            </Link>
          </div>
        </form>

        {/* Social login: chỉ bật nếu BE đang mở /auth/firebase-login */}
        <div className={styles.divider}>Hoặc</div>
        <div className={styles.social}>
          <button className={styles.btnGoogle} onClick={handleGoogleLogin} type="button">
            <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Đăng nhập với Google
          </button>
          <button className={styles.btnFacebook} onClick={handleFacebookLogin} type="button">
            <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Đăng nhập với Facebook
          </button>
        </div>

        {msg && <div className={styles.err}>{msg}</div>}
      </div>
    </div>
  );
}
