// client/src/api/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDk3P6dc8Pdy5iDC0owxf3Ip1h6O4IjEMI',
  authDomain: 'tnq-fashion-store.firebaseapp.com',
  projectId: 'tnq-fashion-store',
  storageBucket: 'tnq-fashion-store.firebasestorage.app',
  messagingSenderId: '950850893755',
  appId: '1:950850893755:web:1ad1eae8a87b884fb3369e',
  measurementId: 'G-0HDKWM2W68',
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithFacebook = () => signInWithPopup(auth, facebookProvider);

// ---- Recaptcha singleton (render đúng 1 lần) ----
const W = window;

function ensureContainer(containerId) {
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    document.body.appendChild(el);
  }
  return el;
}

export function getOrCreateRecaptcha(containerId = 'recaptcha-container', options = {}) {
  if (W._tnqRecaptchaVerifier) return W._tnqRecaptchaVerifier;

  ensureContainer(containerId);

  const size = import.meta.env.VITE_RECAPTCHA_VISIBLE === '1' ? 'normal' : 'invisible';
  const verifier = new RecaptchaVerifier(auth, containerId, { size, ...options });

  verifier
    .render()
    .then((id) => {
      W._tnqRecaptchaWidgetId = id;
    })
    .catch(() => {});

  W._tnqRecaptchaVerifier = verifier;
  return verifier;
}

export function resetRecaptcha() {
  try {
    const id = W._tnqRecaptchaWidgetId;
    if (W.grecaptcha && typeof W.grecaptcha.reset === 'function' && (id || id === 0)) {
      W.grecaptcha.reset(id);
    }
  } catch {}
}

// (Tuỳ chọn) dọn sạch hẳn khi logout
export function clearRecaptcha() {
  try {
    if (W._tnqRecaptchaVerifier && typeof W._tnqRecaptchaVerifier.clear === 'function') {
      W._tnqRecaptchaVerifier.clear();
    }
  } catch {}
  delete W._tnqRecaptchaVerifier;
  delete W._tnqRecaptchaWidgetId;
}

export function toE164VN(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.startsWith('+84')) return s;
  if (s.startsWith('0')) return '+84' + s.slice(1);
  return s;
}

export function sendPhoneOtp(phoneNumber, recaptchaVerifier) {
  const e164 = toE164VN(phoneNumber);
  if (import.meta.env.DEV) console.log('[Firebase] sendPhoneOtp ->', e164);
  return signInWithPhoneNumber(auth, e164, recaptchaVerifier);
}
