import { Link } from 'react-router-dom';
import styles from './Home.module.css';
import HeroSlider from '../components/HeroSlider';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const slides = [
  {
    key: 's1',
    publicId: 'ChatGPT_Image_22_20_03_17_thg_9_2025_wheqme',
    alt: 'Look 1',
    kicker: 'TnQ Fashion',
    title: 'RUNNING GRAPHICS',
    desc: 'Mua 2 giảm thêm 15%',
    ctaText: 'Mua ngay',
    ctaHref: '/products',
  },
  {
    key: 's2',
    publicId: 'ChatGPT_Image_22_42_34_17_thg_9_2025_ak8xie',
    alt: 'Look 2',
    title: 'Color Your Way',
    desc: 'Chất liệu mát – dễ phối',
    ctaText: 'Khám phá',
    ctaHref: '/products?path=nam',
  },
  {
    key: 's3',
    publicId: 'ChatGPT_Image_22_55_26_17_thg_9_2025_xedslk',
    alt: 'Look 3',
    title: 'New Arrivals',
    desc: 'Phong cách tối giản hằng ngày',
    ctaText: 'Xem sản phẩm',
    ctaHref: '/products?path=nu',
  },
];
const cldT = (publicId, t) =>
  CLOUD && publicId
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,${t}/${publicId}`
    : '';

const HERO_ID = 'ChatGPT_Image_22_10_48_17_thg_9_2025_asz5fa';

// 3 size để responsive (dùng <picture/>)
const hero = {
  desktop: cldT(HERO_ID, 'w_1920,ar_21:9,c_fill,g_auto'),
  tablet: cldT(HERO_ID, 'w_1280,ar_16:9,c_fill,g_auto'),
  mobile: cldT(HERO_ID, 'w_768,ar_4:3,c_fill,g_auto'),
};

// tiles danh mục (không phải ảnh sp; để "" sẽ dùng gradient fallback)
const tiles = [
  {
    key: 'men',
    title: 'Bộ sưu tập Nam',
    to: '/products?path=nam',
    img: '',
    gradient: 'var(--g-indigo)',
  },
  {
    key: 'women',
    title: 'Bộ sưu tập Nữ',
    to: '/products?path=nu',
    img: '',
    gradient: 'var(--g-pink)',
  },
  {
    key: 'accessories',
    title: 'Phụ kiện',
    to: '/products?path=phu-kien',
    img: '',
    gradient: 'var(--g-amber)',
  },
  {
    key: 'sale',
    title: 'Khuyến mãi',
    to: '/products?sale=1',
    img: '',
    gradient: 'var(--g-emerald)',
  },
];

export default function Home() {
  return (
    <>
      <HeroSlider slides={slides} interval={2000} />
      {/* HERO full-bleed (tràn chiều ngang màn hình)
      <section className={`${styles.fullBleed} ${styles.heroBanner}`}>
        <picture>
          <source media="(min-width: 1024px)" srcSet={hero.desktop} />
          <source media="(min-width: 640px)" srcSet={hero.tablet} />
          <img src={hero.mobile || ''} alt="Cửa hàng TnQ Fashion" className={styles.heroImg} />
        </picture>

        <div className={styles.bannerText}>
          <div className={styles.bannerTextInner}>
            <h1 className={styles.bannerTitle}>TnQ Fashion</h1>
            <p className={styles.bannerDesc}>Phong cách tối giản – mặc đẹp mỗi ngày.</p>
            <div className={styles.ctaGroup}>
              <Link to="/products" className={`${styles.btn} ${styles.btnPrimary}`}>
                Mua ngay
              </Link>
              <Link to="/products?sale=1" className={`${styles.btn} ${styles.btnGhost}`}>
                Ưu đãi hôm nay
              </Link>
            </div>
          </div>
        </div>
      </section> */}

      {/* Phần còn lại trong container */}
      <div className="container">
        <section className={styles.usp}>
          <div className={styles.uspItem}>🚚 Freeship đơn từ 499K</div>
          <div className={styles.uspItem}>↩️ Đổi trả 7 ngày</div>
          <div className={styles.uspItem}>💬 Hỗ trợ 24/7</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Danh mục nổi bật</h2>
            <Link to="/products" className={styles.linkMore}>
              Xem tất cả →
            </Link>
          </div>
          <div className={styles.grid}>
            {tiles.map((c) => (
              <Link to={c.to} key={c.key} className={styles.card}>
                <div
                  className={styles.cardMedia}
                  style={{ background: c.img ? `center/cover url('${c.img}')` : c.gradient }}
                />
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{c.title}</h3>
                  <span className={styles.cardAction}>Khám phá</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
