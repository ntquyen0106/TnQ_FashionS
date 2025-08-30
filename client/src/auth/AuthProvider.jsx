import { createContext, useContext, useEffect, useState } from "react";
import { http } from "../api/http";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
  try { await http.post("/auth/logout"); } catch {}
  setUser(null);
};
  return (
    <AuthCtx.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
