import { useEffect, useState } from "react";
import styles from "./Home.module.css";

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>Chào mừng đến với TnQ Fashion</h1>
          <p className={styles.desc}>
            Phong cách đơn giản, chất lượng cao. Bộ sưu tập mới nhất đang chờ bạn.
          </p>

          {/* Nếu có user thì hiện thêm */}
          {user ? (
            <p><b>Xin chào, {user.name}</b> ({user.email})</p>
          ) : (
            <p>Bạn chưa đăng nhập.</p>
          )}

          <a href="/products" className="btn">Xem sản phẩm</a>
        </div>
        <img
          className={styles.heroImg}
          src="https://via.placeholder.com/400x300"
          alt="Fashion"
        />
      </section>
    </div>
  );
}
