import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth-api';
import { useAuth } from '@/auth/AuthProvider';
import styles from './LoginRegister.module.css';
import SuccessModal from '@/components/SuccessModal';

export default function FirstLoginChangePassword() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, title: '', message: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!password || password.length < 6) return setMsg('Mật khẩu tối thiểu 6 ký tự');
    if (password !== confirm) return setMsg('Xác nhận mật khẩu không khớp');

    try {
      setLoading(true);
      await authApi.changePasswordFirst({ newPassword: password });
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      // Đăng xuất và chuyển ngay về trang đăng nhập để dùng mật khẩu mới
      try {
        await authApi.logout();
      } catch (err) {
        console.warn('logout after password change failed', err?.message);
      }
      setUser(null);
      nav('/login', {
        replace: true,
        state: { message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại.' },
      });
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = async () => {
    setSuccessModal({ open: false, title: '', message: '' });
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('logout after password change failed', err?.message);
    }
    setUser(null);
    nav('/login', { replace: true });
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>Đổi mật khẩu lần đầu</h2>
        <p className={styles.sub}>Vui lòng đặt mật khẩu mới để tiếp tục sử dụng hệ thống.</p>
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
              {loading ? 'Đang đổi...' : 'Đổi mật khẩu và tiếp tục'}
            </button>
          </div>
          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
      <SuccessModal
        open={successModal.open}
        title={successModal.title}
        message={successModal.message}
        onClose={handleSuccessClose}
      />
    </div>
  );
}
