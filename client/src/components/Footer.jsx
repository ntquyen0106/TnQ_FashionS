import { useState } from 'react';
import { Link } from 'react-router-dom';
import s from './Footer.module.css';
import { FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import FeedbackModal from './FeedbackModal';

export default function Footer() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  return (
    <>
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      <footer className={s.footer}>
        <div className={s.container}>
          {/* Khối lắng nghe góp ý */}
          <section className={s.feedbackSection}>
            <div className={s.feedbackContent}>
              <h2 className={s.feedbackTitle}>TnQ FASHION lắng nghe bạn!</h2>
              <p className={s.feedbackDesc}>
                Chúng tôi luôn trân trọng và mong đợi nhận được mọi ý kiến đóng góp từ khách hàng để
                có thể nâng cấp trải nghiệm dịch vụ và sản phẩm tốt hơn nữa.
              </p>
            </div>
            <button className={s.feedbackBtn} onClick={() => setShowFeedbackModal(true)}>
              Đóng góp ý kiến
            </button>
          </section>

          {/* Phần link & liên hệ */}
          <div className={s.grid}>
            <div>
              <h3 className={s.title}>VỀ TnQ FASHION</h3>
              <ul className={s.list}>
                <li>
                  <Link to="/about" className={s.link}>
                    Giới thiệu
                  </Link>
                </li>
                <li>
                  <Link to="/recruitment" className={s.link}>
                    Tuyển dụng
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className={s.title}>CHÍNH SÁCH</h3>
              <ul className={s.list}>
                <li>
                  <Link to="/return-policy" className={s.link}>
                    Chính sách đổi trả
                  </Link>
                </li>
                <li>
                  <Link to="/privacy-policy" className={s.link}>
                    Chính sách bảo mật
                  </Link>
                </li>
                <li>
                  <Link to="/shipping-policy" className={s.link}>
                    Chính sách giao hàng
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className={s.title}>CHĂM SÓC KHÁCH HÀNG</h3>
              <ul className={s.list}>
                <li>
                  <Link to="/faq" className={s.link}>
                    Hỏi đáp - FAQs
                  </Link>
                </li>
                <li>
                  <Link to="/size-guide" className={s.link}>
                    Hướng dẫn chọn size
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className={s.title}>LIÊN HỆ</h3>
              <div className={s.contactBox}>
                <p>
                  <strong>Hotline:</strong> 1900.272737
                </p>
                <p>
                  <strong>Email:</strong> contact@tnqfashion.vn
                </p>

                <div className={s.socialRow}>
                  <a href="#" className={s.social} title="Facebook">
                    <FaFacebookF />
                  </a>
                  <a href="#" className={s.social} title="Instagram">
                    <FaInstagram />
                  </a>
                  <a href="#" className={s.social} title="TikTok">
                    <FaTiktok />
                  </a>
                  <a href="https://zalo.me" className={s.social} title="Zalo">
                    <SiZalo />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className={s.bottom}>
            © {new Date().getFullYear()} TnQ Fashion. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
