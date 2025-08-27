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
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMsg("");

    if (!name || !email || !password) {
      return setMsg("Điền đầy đủ tên, email, mật khẩu");
    }

    try {
      setLoading(true);

      // Gọi BE để tạo yêu cầu đăng ký + gửi OTP về email
      // BE nên chỉ trả về message, KHÔNG tự đăng nhập
      const res = await http.post("/auth/register", { name, email, password });

      // Lưu lại email tạm để màn Verify có thể lấy nếu người dùng F5
      sessionStorage.setItem(
        "pendingSignup",
        JSON.stringify({ email })
      );

      // Thông báo nhẹ (tùy bạn muốn hiển thị hay không)
      setMsg(res?.data?.message || "Đã gửi mã xác thực về email của bạn");

      // Điều hướng sang màn nhập mã OTP
      nav("/verify?flow=signup", { state: { email } });
    } catch (e) {
      setMsg(e?.response?.data?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="page-center">
    <div className={`card-narrow ${styles.wrap}`}>
      <h2 className={styles.h1}>Đăng ký</h2>
      <form onSubmit={onSubmit}>
        <div className={styles.field}>
          <label>Họ tên</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn A"
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label>Email</label>
          <input
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label>Mật khẩu</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            disabled={loading}
          />
        </div>

        <div className={styles.actions}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Đang gửi mã..." : "Tạo tài khoản"}
          </button>
          <Link className={styles.link} to="/login">
            Đã có tài khoản? Đăng nhập
          </Link>
        </div>

        {msg && <div className={styles.err}>{msg}</div>}
      </form>
    </div>
      </div>
  );
}
