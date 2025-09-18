import { useEffect, useRef, useState } from 'react';
import s from './HeroSlider.module.css';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// build Cloudinary URL với transform
const cld = (publicId, t) =>
  CLOUD && publicId
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,${t}/${publicId}`
    : '';

export default function HeroSlider({ slides = [], interval = 3000 }) {
  const [idx, setIdx] = useState(0);
  const pausedRef = useRef(false);

  const go = (next) => setIdx((i) => (i + (next ? 1 : -1) + slides.length) % slides.length);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current && slides.length > 1) {
        setIdx((i) => (i + 1) % slides.length);
      }
    }, interval);
    return () => clearInterval(id);
  }, [slides.length, interval]);

  if (!slides.length) return null;

  return (
    <section
      className={`${s.slider} ${s.fullBleed}`}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(true);
        if (e.key === 'ArrowLeft') go(false);
      }}
      tabIndex={0}
      aria-roledescription="carousel"
    >
      {slides.map((slide, i) => {
        const active = i === idx;
        const desktop = cld(slide.publicId, 'w_1920,ar_21:9,c_fill,g_auto');
        const tablet = cld(slide.publicId, 'w_1280,ar_16:9,c_fill,g_auto');
        const mobile = cld(slide.publicId, 'w_768,ar_4:3,c_fill,g_auto');
        return (
          <div
            className={`${s.slide} ${active ? s.active : ''}`}
            key={slide.key || i}
            aria-hidden={!active}
          >
            {slide.publicId ? (
              <picture>
                <source media="(min-width: 1024px)" srcSet={desktop} />
                <source media="(min-width: 640px)" srcSet={tablet} />
                <img className={s.img} src={mobile} alt={slide.alt || ''} />
              </picture>
            ) : (
              <div className={s.fallback} />
            )}

            <div className={s.overlay}>
              <div className={s.overlayInner}>
                {slide.kicker && <span className={s.kicker}>{slide.kicker}</span>}
                {slide.title && <h1 className={s.title}>{slide.title}</h1>}
                {slide.desc && <p className={s.desc}>{slide.desc}</p>}
                {slide.ctaHref && (
                  <a className={`${s.btn} ${s.btnPrimary}`} href={slide.ctaHref}>
                    {slide.ctaText || 'Xem ngay'}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Nav buttons */}
      <button className={`${s.nav} ${s.prev}`} aria-label="Slide trước" onClick={() => go(false)}>
        ‹
      </button>
      <button className={`${s.nav} ${s.next}`} aria-label="Slide sau" onClick={() => go(true)}>
        ›
      </button>

      {/* Dots */}
      <div className={s.dots} role="tablist" aria-label="Chọn slide">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${s.dot} ${i === idx ? s.dotActive : ''}`}
            aria-label={`Chuyển tới slide ${i + 1}`}
            aria-selected={i === idx}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </section>
  );
}
