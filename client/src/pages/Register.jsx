import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import styles from './LoginRegister.module.css';

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!name || !email || !password) {
      return setMsg('Điền đầy đủ tên, email, mật khẩu');
    }

    try {
      setLoading(true);

      const res = await authApi.register({ name, email, password });
      sessionStorage.setItem('pendingSignup', JSON.stringify({ email }));
      setMsg(res?.message || 'Đã gửi mã xác thực về email của bạn');

      nav('/verify?flow=signup', { state: { email } });
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>Đăng ký</h2>
        <p className={styles.sub}>Tạo tài khoản để trải nghiệm mua sắm tốt hơn.</p>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Họ tên</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>👤</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>@</span>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Đang gửi mã...' : 'Tạo tài khoản'}
            </button>
            <Link className={styles.link} to="/login">
              Đã có tài khoản? Đăng nhập
            </Link>
          </div>

          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
