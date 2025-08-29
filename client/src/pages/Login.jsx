import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http";
import { loginWithGoogle, loginWithFacebook } from "../api/firebase";
import { useAuth } from "../auth/AuthProvider";
import styles from "./LoginRegister.module.css";

export default function Login() {
  const nav = useNavigate();
  const { setUser } = useAuth(); // <-- dùng context
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!email || !password) return setMsg("Vui lòng nhập email và mật khẩu");
    try {
      setLoading(true);
      await http.post("/auth/login", { email, password, remember: true }); // cookie httpOnly
      const { data } = await http.get("/auth/me"); // lấy user từ BE
      setUser(data.user);
      // redirect theo role nếu muốn
      if (data.user.role === "admin") nav("/dashboard/admin", { replace: true });
      else if (data.user.role === "staff") nav("/dashboard", { replace: true });
      else nav("/", { replace: true });
    } catch (e) {
      setMsg(e?.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  // --- Google ---
  const handleGoogleLogin = async () => {
    try {
      setMsg("");
      setLoading(true);
      const result = await loginWithGoogle();                 // Firebase client
      const idToken = await result.user.getIdToken();         // lấy idToken
      // Gửi idToken sang BE để BE set cookie + trả user chuẩn
      const { data } = await http.post("/auth/firebase-login", { idToken });
      setUser(data.user);
      nav("/", { replace: true });
    } catch (err) {
      console.error(err);
      setMsg("Đăng nhập Google thất bại");
    } finally {
      setLoading(false);
    }
  };

  // --- Facebook ---
  const handleFacebookLogin = async () => {
    try {
      setMsg("");
      setLoading(true);
      const result = await loginWithFacebook();
      const idToken = await result.user.getIdToken();         // nếu provider không có idToken, hãy ẩn nút FB
      const { data } = await http.post("/auth/firebase-login", { idToken });
      setUser(data.user);
      nav("/", { replace: true });
    } catch (err) {
      console.error(err);
      setMsg("Đăng nhập Facebook thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className={`card-narrow ${styles.wrap}`}>
        <h2 className={styles.h1}>Đăng nhập</h2>
        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
          </div>
          <div className={styles.field}>
            <label>Mật khẩu</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
            <Link className={styles.link} to="/register">Chưa có tài khoản? Đăng ký</Link>
            <Link className={styles.link} to="/forgot" style={{ marginLeft: 10 }}>Quên mật khẩu?</Link>
          </div>
        </form>

        {/* Social login: chỉ bật nếu BE đang mở /auth/firebase-login */}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button className="btn" style={{ marginBottom: 10 }} onClick={handleGoogleLogin}>
            Đăng nhập với Google
          </button>
          <br />
          <button className="btn" onClick={handleFacebookLogin}>
            Đăng nhập với Facebook
          </button>
        </div>

        {msg && <div className={styles.err}>{msg}</div>}
      </div>
    </div>
  );
}
