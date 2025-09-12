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
    <div className="page-center">
      <div className={`card-narrow ${styles.wrap}`}>
        <h2 className={styles.h1}>Tạo mật khẩu mới</h2>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label>Mật khẩu mới</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              disabled={loading}
            />
          </div>
          <div className={styles.field}>
            <label>Nhập lại mật khẩu</label>
            <input
              className={styles.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••"
              disabled={loading}
            />
          </div>
          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={loading}>
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
