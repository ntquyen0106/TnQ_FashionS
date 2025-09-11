import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { loginWithGoogle, loginWithFacebook } from '../api/firebase';
import { useAuth } from '../auth/AuthProvider';
import styles from './LoginRegister.module.css';

export default function Login() {
  const nav = useNavigate();
  const { setUser } = useAuth(); // <-- dùng context
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      // 1. Gọi login
      await authApi.login({ email, password, remember: true });

      // 2. Thử gọi me()
      let me = null;
      try {
        me = await authApi.me();
        setUser(me);
      } catch {
        // nếu cookie chưa kịp sync, AuthProvider sẽ lo gọi lại
        console.debug('me() sau login chưa kịp có cookie, bỏ qua.');
      }

      // 3. Điều hướng
      if (me?.role === 'admin') nav('/dashboard/admin', { replace: true });
      else if (me?.role === 'staff') nav('/dashboard', { replace: true });
      else nav('/', { replace: true });
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

      // trả về { user }, không destructure data
      const { user } = await authApi.firebaseLogin(idToken);

      setUser(user);
      nav('/', { replace: true });
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
      nav('/', { replace: true });
    } catch (err) {
      console.error(err);
      setMsg('Đăng nhập Facebook thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className={`card-narrow ${styles.wrap}`}>
        <h2 className={styles.h1}>Đăng nhập</h2>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
          </div>
          <div className={styles.field}>
            <label>Mật khẩu</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={loading}>
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
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button className="btn" style={{ marginBottom: 10 }} onClick={handleGoogleLogin}>
            Đăng nhập với Google
          </button>
          <br />
          <button className="btn" onClick={handleFacebookLogin}>
            Đăng nhập với Facebook
          </button>
        </div>

        {msg && <div className={styles.err}>{msg}</div>}
      </div>
    </div>
  );
}
