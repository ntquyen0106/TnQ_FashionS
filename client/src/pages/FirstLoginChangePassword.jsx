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
      // Refresh profile to clear mustChange flag
      try {
        const me = await authApi.me();
        if (me) setUser(me);
      } catch {}
      // Show success modal then redirect by role after close
      setSuccessModal({
        open: true,
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu đã được cập nhật',
      });
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
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
        onClose={() => {
          setSuccessModal({ open: false, title: '', message: '' });
          // Redirect by role
          const role = user?.role || 'user';
          if (role === 'admin') nav('/dashboard/admin', { replace: true });
          else if (role === 'staff') nav('/dashboard', { replace: true });
          else nav('/', { replace: true });
        }}
      />
    </div>
  );
}
