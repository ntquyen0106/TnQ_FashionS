import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { getOrCreateRecaptcha, resetRecaptcha, sendPhoneOtp, toE164VN } from '@/api/firebase';
import { useAuth } from '@/auth/AuthProvider';
import styles from './LoginRegister.module.css';

export default function Register() {
  const nav = useNavigate();
  const { setUser } = useAuth();

  // Form fields
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState(''); // optional
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Flow and helpers
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otp, setOtp] = useState('');
  const confirmationRef = useRef(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    if (!countdown) return;
    const t = setInterval(() => setCountdown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Initialize a single reCAPTCHA verifier instance on mount and reuse it (do not re-render)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = getOrCreateRecaptcha('recaptcha-container');
        if (mounted) recaptchaRef.current = v;
      } catch (e) {
        console.warn('[Register] reCAPTCHA init failed:', e);
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
      return (
        'Tính năng gửi SMS của Firebase yêu cầu bật billing (Blaze). ' +
        'Bạn có thể tạm thời dùng "Test phone numbers" trong Firebase Console để phát triển, hoặc bật billing trong Firebase/GCP.'
      );
    }
    if (code.includes('invalid-app-credential') || code.includes('recaptcha')) {
      return 'Không xác thực được reCAPTCHA. Hãy thêm domain dev vào Authorized domains (Authentication → Settings) và tắt adblock/extension rồi thử lại.';
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

  // Submit step 1: validate and request server register, then send SMS via Firebase
  const onSubmitForm = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg('');

    if (!name || !phoneNumber || !password || !confirmPassword) {
      return setMsg('Vui lòng điền đầy đủ Họ tên, SĐT, mật khẩu và xác nhận mật khẩu');
    }
    if (password.length < 6) return setMsg('Mật khẩu phải tối thiểu 6 ký tự');
    if (password !== confirmPassword) return setMsg('Xác nhận mật khẩu không khớp');

    try {
      setLoading(true);

      // Step 1: Tell server about intended registration and validate inputs
      const res = await authApi.register({
        phoneNumber,
        email: email || undefined,
        password,
        confirmPassword,
        name,
      });

      // Step 2: Trigger Firebase SMS using the existing verifier
      const verifier = recaptchaRef.current || getOrCreateRecaptcha('recaptcha-container');
      if (!verifier) {
        setMsg('Không thể khởi tạo reCAPTCHA. Vui lòng reload trang và thử lại.');
        return;
      }
      const e164 = toE164VN(phoneNumber);
      if (import.meta.env.DEV) console.log('[Register] sending OTP to', e164);
      const confirmation = await sendPhoneOtp(e164, verifier);
      confirmationRef.current = confirmation;

      setMsg(res?.message || 'Mã xác thực SMS đã được gửi.');
      setStep('otp');
      setCountdown(30);
    } catch (e) {
      if (e?.code?.startsWith?.('auth/')) {
        console.error('[Register] sendPhoneOtp error:', e);
        setMsg(explainFirebaseError(e));
      } else {
        setMsg(e?.response?.data?.message || e?.message || 'Đăng ký thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  // Confirm OTP and finalize account creation + login
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

      // Finalize on server and set cookie
      const result = await authApi.verifyPhone({
        firebaseIdToken,
        phoneNumber,
        email: email || undefined,
        password,
        name,
      });

      // Fetch current user from cookie session
      const me = await authApi.me();
      if (me) setUser(me);

      setMsg(result?.message || 'Đăng ký thành công');
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
      // Reset existing widget before sending another OTP
      resetRecaptcha();
      const e164 = toE164VN(phoneNumber);
      if (import.meta.env.DEV) console.log('[Register] resend OTP to', e164);
      const confirmation = await sendPhoneOtp(e164, verifier);
      confirmationRef.current = confirmation;
      setMsg('Đã gửi lại mã OTP qua SMS');
      setCountdown(30);
    } catch (e) {
      if (e?.code?.startsWith?.('auth/')) {
        console.error('[Register] resend sendPhoneOtp error:', e);
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
        <h2 className={styles.h1}>Đăng ký</h2>
        <p className={styles.sub}>Sử dụng SĐT để đăng ký. Email là không bắt buộc.</p>

        {step === 'form' && (
          <form onSubmit={onSubmitForm}>
            <div className={styles.field}>
              <label className={styles.label}>Họ tên</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>👤</span>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  disabled={loading}
                />
              </div>
            </div>

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

            <div className={styles.field}>
              <label className={styles.label}>Email (không bắt buộc)</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>@</span>
                <input
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com (không bắt buộc)"
                  disabled={loading}
                  type="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mật khẩu</label>
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
              <label className={styles.label}>Xác nhận mật khẩu</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Đang gửi mã...' : 'Tiếp tục'}
              </button>
              <Link className={styles.link} to="/login">
                Đã có tài khoản? Đăng nhập
              </Link>
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
              <Link className={styles.link} to="/register" style={{ marginLeft: 8 }}>
                Sửa thông tin?
              </Link>
            </div>

            {msg && <div className={styles.err}>{msg}</div>}
          </form>
        )}

        {/* Container cho reCAPTCHA của Firebase (invisible) */}
        <div id="recaptcha-container" style={{ display: 'grid', placeItems: 'center' }} />
      </div>
    </div>
  );
}
