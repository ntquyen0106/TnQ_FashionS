import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { authApi } from '@/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Lưu ý: Cookie HttpOnly sẽ không hiển thị trong document.cookie.
// Vì vậy luôn gọi /auth/me để kiểm tra phiên thay vì dựa vào document.cookie.

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const meInFlight = useRef(false); // chặn gọi trùng trong StrictMode

  const bootstrap = useCallback(async () => {
    if (meInFlight.current) return;
    meInFlight.current = true;

    try {
      // Gọi /auth/me để xác thực phiên dựa trên cookie HttpOnly
      const u = await authApi.me(); // trả về r.data.user
      setUser(u || null);
    } catch {
      setUser(null); // 401 -> khách
    } finally {
      setLoading(false);
      meInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // dùng trong login: nhận user trả về và set ngay
  const applyLogin = (user) => setUser(user);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, logout, applyLogin }}>
      {children}
    </AuthCtx.Provider>
  );
}
