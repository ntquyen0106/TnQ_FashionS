import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http";
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

  return (
    <div className={styles.wrap}>
      <h2 className={styles.h1}>Đăng nhập</h2>
      <form onSubmit={onSubmit}>
        <div className={styles.field}>
          <label>Email</label>
          <input className={styles.input} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className={styles.field}>
          <label>Mật khẩu</label>
          <input className={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" />
        </div>
        <div className={styles.actions}>
          <button className="btn" type="submit">Đăng nhập</button>
          <Link className={styles.link} to="/register">Chưa có tài khoản? Đăng ký</Link>
        </div>
        {msg && <div className={styles.err}>{msg}</div>}
      </form>
    </div>
  );
}
