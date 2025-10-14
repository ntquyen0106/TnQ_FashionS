import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api';
import styles from './LoginRegister.module.css';

export default function Forgot() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');
    if (!email) return setMsg('Nhập email của bạn');

    try {
      setLoading(true);
      const res = await authApi.forgot(email);
      sessionStorage.setItem('pwResetEmail', email);
      setMsg(res?.message || 'Đã gửi mã OTP vào email của bạn');
      nav('/verify?flow=reset', { state: { email } });
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Không gửi được mã. Thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>Quên mật khẩu</h2>
        <p className={styles.sub}>Nhập email để nhận mã xác thực đặt lại mật khẩu.</p>
        <form onSubmit={onSubmit}>
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
          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
            </button>
            <Link className={styles.link} to="/login">
              Quay lại đăng nhập
            </Link>
          </div>
          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
