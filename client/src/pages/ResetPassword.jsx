import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api';
import styles from './LoginRegister.module.css';
import SuccessModal from '@/components/SuccessModal';

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, title: '', message: '' });

  useEffect(() => {
    // Support resetToken provided via query param (admin link) or sessionStorage
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('resetToken');
    const sessionToken = sessionStorage.getItem('pwResetToken');
    const token = qToken || sessionToken;
    if (!token) nav('/forgot');
    if (qToken && !sessionToken) {
      // keep token in session so user can reload safely
      sessionStorage.setItem('pwResetToken', qToken);
      sessionStorage.setItem('pwResetEmail', params.get('email') || '');
    }
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!password || !confirmPassword) return setMsg('Vui lòng nhập mật khẩu và xác nhận');
    if (password.length < 6) return setMsg('Mật khẩu phải tối thiểu 6 ký tự');
    if (password !== confirmPassword) return setMsg('Mật khẩu xác nhận không khớp');

    try {
      setLoading(true);
      const resetToken = sessionStorage.getItem('pwResetToken');
      if (!resetToken)
        return setMsg('Thiếu token đổi mật khẩu. Vui lòng thử lại từ Quên mật khẩu.');

      await authApi.resetPassword({ resetToken, newPassword: password });
      sessionStorage.removeItem('pwResetToken');
      sessionStorage.removeItem('pwResetEmail');

      // Sau khi đổi thành công, chuyển thẳng về login để đăng nhập bằng mật khẩu mới
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
        <h2 className={styles.h1}>Tạo mật khẩu mới</h2>
        <p className={styles.sub}>Mật khẩu cần tối thiểu 6 ký tự và dễ nhớ với bạn.</p>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu mới</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
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

          <div className={styles.field}>
            <label className={styles.label}>Nhập lại mật khẩu</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={styles.input}
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowConfirmPassword((s) => !s)}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
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
      <SuccessModal open={false} />
    </div>
  );
}
