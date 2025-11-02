import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { getOrCreateRecaptcha, resetRecaptcha, sendPhoneOtp, toE164VN } from '@/api/firebase';
import { useAuth } from '@/auth/AuthProvider';
import styles from './LoginRegister.module.css';

export default function AddPhone() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();

  // If user already has phone (in future when included), we could redirect. For now assume needs phone.
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    if (!countdown) return;
    const t = setInterval(() => setCountdown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = getOrCreateRecaptcha('recaptcha-container');
        if (mounted) recaptchaRef.current = v;
      } catch (e) {
        console.warn('[AddPhone] reCAPTCHA init failed:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const explainFirebaseError = (e) => {
    const code = e?.code || '';
    const msg = e?.message || '';
    if (code.includes('operation-not-allowed')) {
      return 'Phone sign-in chưa được bật trong Firebase. Vào Firebase Console → Authentication → Sign-in method → bật Phone.';
    }
    if (code.includes('billing-not-enabled')) {
      return 'Gửi SMS OTP yêu cầu bật billing (Blaze). Có thể dùng số test trong Firebase cho môi trường dev.';
    }
    if (code.includes('invalid-app-credential') || code.includes('recaptcha')) {
      return 'Không xác thực được reCAPTCHA. Hãy thêm domain dev vào Authorized domains và tắt adblock/extension rồi thử lại.';
    }
    if (code.includes('too-many-requests')) {
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    if (code.includes('network-request-failed')) {
      return 'Lỗi mạng khi gọi Firebase. Kiểm tra kết nối hoặc thử lại.';
    }
    if (code.includes('invalid-phone-number')) {
      return 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại định dạng (0xxxxxxxxx hoặc +84xxxxxxxxx).';
    }
    return msg || 'Gửi OTP thất bại';
  };

  const onSendOtp = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!phoneNumber) return setMsg('Vui lòng nhập số điện thoại');

    try {
      setLoading(true);
      const verifier = recaptchaRef.current || getOrCreateRecaptcha('recaptcha-container');
      if (!verifier) {
        setMsg('Không thể khởi tạo reCAPTCHA. Vui lòng tải lại trang.');
        return;
      }
      const e164 = toE164VN(phoneNumber);
      if (import.meta.env.DEV) console.log('[AddPhone] sending OTP to', e164);
      const confirmation = await sendPhoneOtp(e164, verifier);
      confirmationRef.current = confirmation;
      setMsg('Đã gửi mã xác thực SMS.');
      setStep('otp');
      setCountdown(30);
    } catch (e) {
      if (e?.code?.startsWith?.('auth/')) {
        console.error('[AddPhone] sendPhoneOtp error:', e);
        setMsg(explainFirebaseError(e));
      } else {
        setMsg(e?.response?.data?.message || e?.message || 'Gửi OTP thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const onConfirmOtp = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');
    if (!otp || otp.length < 6) return setMsg('Nhập đủ 6 số OTP');

    try {
      setLoading(true);
      const confirmation = confirmationRef.current;
      if (!confirmation) throw new Error('Thiếu phiên xác thực SMS');

      const cred = await confirmation.confirm(otp);
      const firebaseIdToken = await cred.user.getIdToken();

      // Call server to attach phone to current user
      const result = await authApi.addPhone({ firebaseIdToken, phoneNumber });

      // Refresh current session's user and go home
      try {
        const me = await authApi.me();
        if (me) setUser(me);
      } catch {}

      setMsg(result?.message || 'Thêm số điện thoại thành công');
      nav('/', { replace: true });
    } catch (e) {
      setMsg(e?.response?.data?.message || 'Xác thực OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resending || countdown > 0 || step !== 'otp') return;
    setMsg('');
    try {
      setResending(true);
      const verifier = recaptchaRef.current || getOrCreateRecaptcha('recaptcha-container');
      if (!verifier) {
        setMsg('Không tìm thấy reCAPTCHA để gửi lại mã. Vui lòng reload trang.');
        return;
      }
      resetRecaptcha();
      const e164 = toE164VN(phoneNumber);
      if (import.meta.env.DEV) console.log('[AddPhone] resend OTP to', e164);
      const confirmation = await sendPhoneOtp(e164, verifier);
      confirmationRef.current = confirmation;
      setMsg('Đã gửi lại mã OTP qua SMS');
      setCountdown(30);
    } catch (e) {
      if (e?.code?.startsWith?.('auth/')) {
        console.error('[AddPhone] resend sendPhoneOtp error:', e);
        setMsg(explainFirebaseError(e));
      } else {
        setMsg(e?.response?.data?.message || e?.message || 'Gửi lại mã thất bại');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrap}>
        <h2 className={styles.h1}>Thêm số điện thoại</h2>
        <p className={styles.sub}>Bạn cần xác thực SĐT để tiếp tục sử dụng tài khoản.</p>

        {step === 'form' && (
          <form onSubmit={onSendOtp}>
            <div className={styles.field}>
              <label className={styles.label}>Số điện thoại</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>📱</span>
                <input
                  className={styles.input}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0xxxxxxxxx hoặc +84xxxxxxxxx"
                  disabled={loading}
                  inputMode="tel"
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
              </button>
            </div>

            {msg && <div className={styles.err}>{msg}</div>}
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={onConfirmOtp}>
            <p className={styles.sub}>Mã OTP đã được gửi tới SĐT {phoneNumber}.</p>
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
            </div>

            {msg && <div className={styles.err}>{msg}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
