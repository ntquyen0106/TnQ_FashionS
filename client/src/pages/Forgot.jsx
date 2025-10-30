import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/api';
import styles from './LoginRegister.module.css';
import { getOrCreateRecaptcha, sendPhoneOtp, toE164VN, resetRecaptcha } from '@/api/firebase';

export default function Forgot() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');
    if (!identifier) return setMsg('Nhập email hoặc số điện thoại của bạn');

    // Determine if identifier looks like a phone (0xxxx or +84xxx)
    const isPhone =
      String(identifier)
        .trim()
        .match(/^\+?\d+$/) && /(^0\d{8,9}$)|(^\+84\d{8,9}$)/.test(identifier.trim());

    try {
      setLoading(true);
      if (!isPhone) {
        const res = await authApi.forgot(identifier);
        sessionStorage.setItem('pwResetEmail', identifier);
        setMsg(res?.message || 'Đã gửi mã OTP vào email của bạn');
        nav('/verify?flow=reset', { state: { email: identifier } });
      } else {
        // Phone flow: send Firebase SMS -> store confirmation globally and navigate to verify
        const recaptcha = await getOrCreateRecaptcha('recaptcha-container');
        const e164 = toE164VN(identifier);
        const confirmation = await sendPhoneOtp(e164, recaptcha);
        // store confirmation so VerifyCode can confirm OTP (use a distinct key)
        window.__tnqForgotConfirmation = confirmation;
        sessionStorage.setItem('pwResetPhone', e164);
        setMsg('Mã OTP đã được gửi qua SMS');
        nav('/verify?flow=reset', { state: { phone: e164 } });
      }
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
        <p className={styles.sub}>
          Nhập email hoặc số điện thoại để nhận mã xác thực đặt lại mật khẩu.
        </p>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email hoặc SĐT</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>@</span>
              <input
                className={styles.input}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com hoặc 0xxxxxxxxx"
                disabled={loading}
                inputMode="text"
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
