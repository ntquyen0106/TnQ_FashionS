import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import styles from './Home.module.css';
import HeroSlider from '../components/HeroSlider';
import FeaturedProducts from '@/components/FeaturedProducts';
import { getCategories } from '@/api/category';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// Resolve exact category path for "mắt kính" from category tree to link directly to that page
const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const findByKeywords = (nodes, keywords) => {
  for (const n of nodes || []) {
    const name = normalize(n.name);
    if (keywords.some((k) => name.includes(k))) return n;
    const child = findByKeywords(n.children || [], keywords);
    if (child) return child;
  }
  return null;
};

function Home() {
  const [eyewearPath, setEyewearPath] = useState('/products?path=phu-kien');
  const [catsLoaded, setCatsLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tree = await getCategories({ status: 'active', asTree: 1 });
        const target = findByKeywords(tree, [
          'kinh',
          'mat kinh',
          'kinh mat',
          'sunglass',
          'glasses',
        ]);
      } catch {
      } finally {
        if (alive) setCatsLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const slides = useMemo(
    () => [
      {
        key: 's1',
        publicId: 'ChatGPT_Image_22_20_03_17_thg_9_2025_wheqme',
        alt: 'Phụ kiện mắt kính',
        kicker: 'Phụ kiện',
        title: 'Mắt kính',
        // desc: 'Bộ sưu tập mắt kính – thời trang và bảo vệ.',
        ctaText: 'Khám phá mắt kính ngay thôi!',
        ctaHref: eyewearPath,
        pos: { bottom: 100, left: 40 },
        align: 'center',

        kickerStyle: {
          marginBottom: 20,
          fontSize: '20px',
          fontWeight: 600,
        },

        ctaStyle: {
          marginTop: 12,
          padding: '14px 20px',
          borderRadius: 12,
          background: '#000000ff',
        },

        titleStyle: {
          marginBottom: 350,
          fontSize: '45px',
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
      },
      {
        key: 's2',
        publicId: 'ChatGPT_Image_22_42_34_17_thg_9_2025_ak8xie',
        alt: 'Jeans nữ',
        // title: 'Quần jeans',
        ctaText: 'Xem ngay thôi!',
        ctaHref: '/products?path=nu&q=jeans',
        pos: { bottom: 100, right: 40 },
        align: 'right',

        titleStyle: {
          fontSize: '30px',
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
        ctaStyle: {
          marginTop: 8,
          padding: '12px 18px',
          borderRadius: 12,
          background: '#000000ff',
        },
        containerStyle: {
          maxWidth: 720, // tùy chọn: giới hạn bề ngang khối chữ
        },
      },
      {
        key: 's3',
        publicId: 'ChatGPT_Image_22_55_26_17_thg_9_2025_xedslk',
        alt: 'Phụ kiện túi xách & mắt kính',
        kicker: 'Phụ kiện',
        title: 'Túi xách & Mắt kính',
        ctaText: 'Mua ngay!',
        ctaHref: '/products?path=phu-kien',
        pos: { bottom: 48, right: 40 },
        align: 'center',
        kickerStyle: { color: '#000000ff', marginBottom: '40px' },
        titleStyle: { fontSize: '30px', color: '#000000ff', marginBottom: '50px' },
      },
    ],
    [eyewearPath],
  );
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

        {/* Sản phẩm nổi bật tổng */}
        <FeaturedProducts
          title="Sản phẩm nổi bật"
          query={{ sort: 'createdAt:desc' }}
          limit={4}
          moreLink="/products"
        />

        {/* Theo loại: Nam / Nữ / Phụ kiện */}
        <FeaturedProducts
          title="Bộ sưu tập Nam"
          query={{ path: 'nam', sort: 'createdAt:desc' }}
          limit={4}
          moreLink="/products?path=nam"
        />
        <FeaturedProducts
          title="Bộ sưu tập Nữ"
          query={{ path: 'nu', sort: 'createdAt:desc' }}
          limit={4}
          moreLink="/products?path=nu"
        />
        <FeaturedProducts
          title="Phụ kiện"
          query={{ path: 'phu-kien', sort: 'createdAt:desc' }}
          limit={4}
          moreLink="/products?path=phu-kien"
        />
      </div>
    </>
  );
}

export default Home;
