import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../api/http";
import styles from "./LoginRegister.module.css";

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!name || !email || !password) return setMsg("Điền đầy đủ tên, email, mật khẩu");
    try {
      const res = await http.post("/auth/register", { name, email, password });
      localStorage.setItem("user", JSON.stringify(res.data.user));
      nav("/"); // auto login xong về home
    } catch (e) {
      setMsg(e?.response?.data?.message || "Đăng ký thất bại");
    }
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.h1}>Đăng ký</h2>
      <form onSubmit={onSubmit}>
        <div className={styles.field}>
          <label>Họ tên</label>
          <input className={styles.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Nguyễn Văn A" />
        </div>
        <div className={styles.field}>
          <label>Email</label>
          <input className={styles.input} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className={styles.field}>
          <label>Mật khẩu</label>
          <input className={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" />
        </div>
        <div className={styles.actions}>
          <button className="btn" type="submit">Tạo tài khoản</button>
          <Link className={styles.link} to="/login">Đã có tài khoản? Đăng nhập</Link>
        </div>
        {msg && <div className={styles.err}>{msg}</div>}
      </form>
    </div>
  );
}
