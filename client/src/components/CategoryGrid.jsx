import { Link } from 'react-router-dom';
import styles from './CategoryGrid.module.css';

/**
 * props:
 *  - items: [{key, title, to, img}]  // img: URL Cloudinary
 *  - title: tiêu đề section
 *  - moreLink: link "Xem tất cả"
 */
export default function CategoryGrid({ title, moreLink = '/products', items = [] }) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2>{title}</h2>
        <Link to={moreLink} className={styles.more}>
          Xem tất cả →
        </Link>
      </div>

      <div className={styles.grid}>
        {items.map((it) => (
          <Link to={it.to} className={styles.card} key={it.key}>
            <img src={it.img} alt={it.title} className={styles.cardImg} />
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{it.title}</h3>
              <span className={styles.cardAction}>Mua ngay</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
