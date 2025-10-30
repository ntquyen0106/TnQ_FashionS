import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api'; // 👉 thay vì import http
import styles from './LoginRegister.module.css';
import { getOrCreateRecaptcha, resetRecaptcha, sendPhoneOtp } from '@/api/firebase';

export default function VerifyCode() {
  const nav = useNavigate();
  const { state, search } = useLocation();
  const params = new URLSearchParams(search);
  const flow = params.get('flow') || state?.flow || 'forgot';

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
        return (
          sessionStorage.getItem('pwResetEmail') || sessionStorage.getItem('pwResetPhone') || ''
        );
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
        // Support both email and phone reset flows
        if (state?.phone || /^\+?\d+$/.test(email)) {
          // Phone flow: confirm via Firebase confirmation stored globally
          const confirmation = window.__tnqForgotConfirmation || window._pwConfirmation;
          console.debug(
            '[VerifyCode] phone-flow confirm, state.phone=',
            state?.phone,
            'email=',
            email,
          );
          if (!confirmation)
            throw new Error('Phiên xác thực SMS không tồn tại. Vui lòng gửi lại mã.');
          // confirm the SMS code (this signs in a temporary Firebase user locally)
          const cred = await confirmation.confirm(otp);
          console.debug('[VerifyCode] firebase confirmation ok, uid=', cred?.user?.uid);
          const firebaseIdToken = await cred.user.getIdToken();

          // Call server endpoint to verify firebase token and return resetToken
          try {
            console.debug('[VerifyCode] calling verifyForgotPhone with phone=', email);
            const res = await authApi.verifyForgotPhone({ firebaseIdToken, phoneNumber: email });
            const resetToken = res?.resetToken;
            if (!resetToken) throw new Error('Thiếu resetToken');
            sessionStorage.setItem('pwResetToken', resetToken);
            nav('/forgot/reset');
          } catch (err) {
            // If server doesn't support phone-based forgot, show helpful message
            console.error(err);
            throw new Error(
              err?.response?.data?.message || 'Server chưa hỗ trợ đặt lại mật khẩu qua SMS.',
            );
          }
        } else {
          const res = await authApi.verifyForgotOtp({ email, otp });
          const resetToken = res?.resetToken;
          if (!resetToken) throw new Error('Thiếu resetToken');
          sessionStorage.setItem('pwResetToken', resetToken);
          nav('/forgot/reset');
        }
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
        setMsg('Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
      } else {
        // If phone flow, resend via Firebase
        if (state?.phone || /^\+?\d+$/.test(email)) {
          const recaptcha = await getOrCreateRecaptcha('recaptcha-container');
          resetRecaptcha();
          const confirmation = await sendPhoneOtp(email, recaptcha);
          window.__tnqForgotConfirmation = confirmation;
          setMsg('Đã gửi lại mã OTP qua SMS');
        } else {
          await authApi.forgot(email);
          setMsg('Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
        }
      }
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
        <h2 className={styles.h1}>Xác thực OTP quên mật khẩu</h2>
        <p className={styles.sub}>
          Mã xác thực đã được gửi tới <b>{email}</b>.
        </p>

        <form onSubmit={onVerify}>
          <div className={styles.field}>
            <label className={styles.label}>Mã OTP</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>#</span>
              <input
                className={styles.otpInput}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="______"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                aria-label="Mã OTP 6 chữ số"
                disabled={loading}
              />
            </div>
            <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
              Vui lòng nhập mã 6 chữ số
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
              Sửa email hoặc số điện thoại?
            </Link>
          </div>

          {msg && <div className={styles.err}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
