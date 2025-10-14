import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api'; // 👉 thay vì import http
import styles from './LoginRegister.module.css';

export default function VerifyCode() {
  const nav = useNavigate();
  const { state, search } = useLocation();
  const params = new URLSearchParams(search);
  const flow = params.get('flow') || state?.flow || 'signup';

  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const email = useMemo(() => {
    if (state?.email) return state.email;
    try {
      if (flow === 'signup') {
        return JSON.parse(sessionStorage.getItem('pendingSignup') || '{}').email || '';
      } else {
        return sessionStorage.getItem('pwResetEmail') || '';
      }
    } catch {
      return '';
    }
  }, [state, flow]);

  useEffect(() => {
    if (!email) {
      nav(flow === 'signup' ? '/register' : '/forgot');
    }
  }, [email, flow, nav]);

  useEffect(() => {
    if (!countdown) return;
    const t = setInterval(() => setCountdown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const onVerify = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');
    if (!otp) return setMsg('Nhập mã OTP');

    try {
      setLoading(true);

      if (flow === 'signup') {
        await authApi.verifySignupOtp({ email, otp });
        sessionStorage.removeItem('pendingSignup');
        alert('Xác thực thành công!');
        nav('/login');
      } else {
        const res = await authApi.verifyForgotOtp({ email, otp });
        const resetToken = res?.resetToken;
        if (!resetToken) throw new Error('Thiếu resetToken');
        sessionStorage.setItem('pwResetToken', resetToken);
        nav('/forgot/reset');
      }
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resending || countdown > 0) return;
    setMsg('');
    try {
      setResending(true);
      if (flow === 'signup') {
        await authApi.resendSignupOtp(email);
      } else {
        await authApi.forgot(email);
      }
      setMsg('Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
      setCountdown(30);
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Gửi lại mã thất bại');
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>
          {flow === 'signup' ? 'Xác thực email' : 'Xác thực OTP quên mật khẩu'}
        </h2>
        <p className={styles.sub}>
          Mã xác thực đã được gửi tới <b>{email}</b>.
        </p>

        <form onSubmit={onVerify}>
          <div className={styles.field}>
            <label className={styles.label}>Mã OTP</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>#</span>
              <input
                className={styles.input}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập 6 số"
                inputMode="numeric"
                maxLength={6}
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Xác nhận'}
            </button>

            <button
              type="button"
              className={styles.btnGhost}
              onClick={onResend}
              disabled={resending || countdown > 0}
              style={{ marginLeft: 8 }}
            >
              {countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi lại mã'}
            </button>

            <Link
              className={styles.link}
              to={flow === 'signup' ? '/register' : '/forgot'}
              style={{ marginLeft: 8 }}
            >
              Sửa email?
            </Link>
          </div>

          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
