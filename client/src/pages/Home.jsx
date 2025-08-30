import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import styles from './Home.module.css';

export default function Home() {
  const { user, loading } = useAuth(); // lấy user từ context

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>Chào mừng đến với TnQ Fashion</h1>
          <p className={styles.desc}>
            Phong cách đơn giản, chất lượng cao. Bộ sưu tập mới nhất đang chờ bạn.
          </p>

          {!loading && user ? (
            <p>
              <b>Xin chào, {user.name || user.email}</b>
            </p>
          ) : (
            !loading && <p>Bạn chưa đăng nhập.</p>
          )}

          {/* dùng Link thay vì <a href> để tránh reload trang */}
          <Link to="/products" className="btn">
            Xem sản phẩm
          </Link>
        </div>

        <img className={styles.heroImg} src="https://via.placeholder.com/400x300" alt="Fashion" />
      </section>
    </div>
  );
}
