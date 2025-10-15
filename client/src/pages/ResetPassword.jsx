import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api';
import styles from './LoginRegister.module.css';

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('pwResetToken');
    if (!token) nav('/forgot');
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!password || password.length < 6) return setMsg('Mật khẩu tối thiểu 6 ký tự');
    if (password !== confirm) return setMsg('Xác nhận mật khẩu không khớp');

    try {
      setLoading(true);
      const resetToken = sessionStorage.getItem('pwResetToken');
      await authApi.resetPassword({ resetToken, newPassword: password });

      sessionStorage.removeItem('pwResetToken');
      sessionStorage.removeItem('pwResetEmail');

      alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      nav('/login');
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>Tạo mật khẩu mới</h2>
        <p className={styles.sub}>Mật khẩu cần tối thiểu 6 ký tự và dễ nhớ với bạn.</p>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu mới</label>
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
          <div className={styles.field}>
            <label className={styles.label}>Nhập lại mật khẩu</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••"
                disabled={loading}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
            <Link className={styles.link} to="/login">
              Về đăng nhập
            </Link>
          </div>
          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
