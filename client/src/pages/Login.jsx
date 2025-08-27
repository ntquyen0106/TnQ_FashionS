import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http";
import { loginWithGoogle, loginWithFacebook } from "../api/firebase";
import styles from "./LoginRegister.module.css";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!email || !password) return setMsg("Vui lòng nhập email và mật khẩu");
    try {
      const res = await http.post("/auth/login", { email, password });
      localStorage.setItem("user", JSON.stringify(res.data.user));
      nav("/"); // về trang chủ
    } catch (e) {
      setMsg(e?.response?.data?.message || "Đăng nhập thất bại");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      const user = result.user;
      localStorage.setItem("user", JSON.stringify({
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
      }));
      nav("/");
    } catch (err) {
      console.error(err);
      setMsg("Đăng nhập Google thất bại");
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const result = await loginWithFacebook();
      const user = result.user;
      localStorage.setItem("user", JSON.stringify({
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
      }));
      nav("/");
    } catch (err) {
      console.error(err);
      setMsg("Đăng nhập Facebook thất bại");
    }
  };

return (
  <div className="page-center">                     {/* khung canh giữa theo màn hình */}
    <div className={`card-narrow ${styles.wrap}`}>  {/* form thu hẹp đẹp trên desktop */}
      <h2 className={styles.h1}>Đăng nhập</h2>
      <form onSubmit={onSubmit}>
        <div className={styles.field}>
          <label>Email</label>
          <input
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          <button className="btn" type="submit">Đăng nhập</button>
          <Link className={styles.link} to="/register">Chưa có tài khoản? Đăng ký</Link>
          <Link className={styles.link} to="/forgot" style={{ marginLeft: 10 }}>Quên mật khẩu?</Link>
        </div>
      </form>

      {/* Các nút đăng nhập xã hội */}
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
