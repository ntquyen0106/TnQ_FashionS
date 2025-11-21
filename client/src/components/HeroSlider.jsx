import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './HeroSlider.module.css';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// build Cloudinary URL với transform
const cld = (publicId, t) =>
  CLOUD && publicId
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,${t}/${publicId}`
    : '';

export default function HeroSlider({ slides = [], interval = 3000, narrow = false }) {
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
      className={`${s.slider} ${s.fullBleed} ${narrow ? s.narrow : ''}`}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onPointerEnter={() => (pausedRef.current = true)}
      onPointerLeave={() => (pausedRef.current = false)}
      onFocusCapture={() => (pausedRef.current = true)}
      onBlurCapture={() => (pausedRef.current = false)}
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

            {(() => {
              // New: absolute positioning support with slide.pos { top,left,right,bottom } and slide.align
              if (slide.pos && typeof slide.pos === 'object') {
                const style = {};
                for (const k of ['top', 'left', 'right', 'bottom']) {
                  if (slide.pos[k] != null) style[k] = slide.pos[k];
                }
                const align = slide.align || 'left';
                const aCls =
                  align === 'right' ? s.tRight : align === 'center' ? s.tCenter : s.tLeft;
                return (
                  <div
                    className={s.overlayAbs}
                    style={{ ...style, ...(slide.containerStyle || {}) }}
                  >
                    <div className={aCls}>
                      {slide.kicker && (
                        <span className={s.kicker} style={slide.kickerStyle}>
                          {slide.kicker}
                        </span>
                      )}
                      {slide.title && (
                        <h1 className={s.title} style={slide.titleStyle}>
                          {slide.title}
                        </h1>
                      )}
                      {slide.desc && (
                        <p className={s.desc} style={slide.descStyle}>
                          {slide.desc}
                        </p>
                      )}
                      {slide.ctaHref && (
                        <Link
                          className={`${s.btn} ${s.btnPrimary}`}
                          style={slide.ctaStyle}
                          to={slide.ctaHref}
                        >
                          {slide.ctaText || 'Xem ngay'}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              }

              // Back-compat: flex alignment via v/h
              const v = slide.v || 'center';
              const h = slide.h || 'left';
              const vCls = v === 'top' ? s.vTop : v === 'bottom' ? s.vBottom : s.vCenter;
              const hCls = h === 'right' ? s.hRight : h === 'center' ? s.hCenter : s.hLeft;
              return (
                <div className={`${s.overlay} ${vCls}`}>
                  <div className={`${s.overlayInner} ${hCls}`} style={slide.containerStyle}>
                    {slide.kicker && (
                      <span className={s.kicker} style={slide.kickerStyle}>
                        {slide.kicker}
                      </span>
                    )}
                    {slide.title && (
                      <h1 className={s.title} style={slide.titleStyle}>
                        {slide.title}
                      </h1>
                    )}
                    {slide.desc && (
                      <p className={s.desc} style={slide.descStyle}>
                        {slide.desc}
                      </p>
                    )}
                    {slide.ctaHref && (
                      <Link
                        className={`${s.btn} ${s.btnPrimary}`}
                        style={slide.ctaStyle}
                        to={slide.ctaHref}
                      >
                        {slide.ctaText || 'Xem ngay'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      <button className={`${s.nav} ${s.prev}`} aria-label="Slide trước" onClick={() => go(false)}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <button className={`${s.nav} ${s.next}`} aria-label="Slide sau" onClick={() => go(true)}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
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
