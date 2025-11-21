import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import { getCategories } from '@/api/category'; // đã có sẵn bên bạn
// Nếu bạn dùng toast, import vào và dùng ở onError
import { mediaApi } from '@/api/media-api';
import styles from './AdminProductForm.module.css';
import { SHOP_COLORS, SHOP_SIZES } from '@/constants/product-options';
// Đã loại bỏ MediaPicker để chỉ dùng một nút tải tệp

// util: tạo slug không dấu
const slugify = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

// flatten tree -> options
function flattenTree(nodes = [], depth = 0) {
  const out = [];
  for (const n of nodes) {
    out.push({
      _id: n._id,
      name: n.name,
      path: n.path,
      depth,
    });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

export default function AdminProductForm({ onSubmit, initial }) {
  // Gợi ý màu/size phổ biến
  const COLOR_OPTIONS = useMemo(() => SHOP_COLORS, []);
  const SIZE_OPTIONS = useMemo(() => SHOP_SIZES, []);
  // ====== state sản phẩm ======
  const [name, setName] = useState(initial?.name || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [attributes, setAttributes] = useState(initial?.attributes || {});

  const [images, setImages] = useState(
    initial?.images?.length
      ? initial.images
      : [
          // ví dụ khởi tạo rỗng
          // { publicId: "", alt: "", isPrimary: true }
        ],
  );

  const [variants, setVariants] = useState(
    initial?.variants?.length
      ? initial.variants
      : [
          // { sku: "", color: "", size: "", price: 0, stock: 0, imagePublicId: "" }
        ],
  );

  // ====== danh mục ======
  const [catTree, setCatTree] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0); // đếm số upload đang chạy
  const [errors, setErrors] = useState([]);
  const topRef = useRef(null);
  const [errorOpen, setErrorOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getCategories({ status: 'active', asTree: 1 });
        if (mounted) setCatTree(data || []);
      } catch (e) {
        console.error('Load categories failed', e);
        if (mounted) setCatTree([]);
      } finally {
        if (mounted) setLoadingCats(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const catOptions = useMemo(() => flattenTree(catTree), [catTree]);

  // ====== sync slug theo name ======
  useEffect(() => {
    if (!initial?.slug) setSlug(slugify(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // ====== handlers ảnh ======
  const addImage = () =>
    setImages((arr) => [...arr, { publicId: '', alt: '', isPrimary: !arr.length }]);

  const removeImage = (idx) => setImages((arr) => arr.filter((_, i) => i !== idx));

  const updateImage = (idx, patch) =>
    setImages((arr) => arr.map((im, i) => (i === idx ? { ...im, ...patch } : im)));

  const setPrimary = (idx) =>
    setImages((arr) => arr.map((im, i) => ({ ...im, isPrimary: i === idx })));

  const moveImage = (from, to) =>
    setImages((arr) => {
      if (to < 0 || to >= arr.length) return arr;
      const next = arr.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

  // Bỏ MediaPicker nên không cần state chọn từ thư viện

  // ====== handlers variants ======
  const addVariant = () =>
    setVariants((arr) => [
      ...arr,
      { sku: '', color: '', size: '', price: 0, stock: 0, imagePublicId: '' },
    ]);

  const removeVariant = (idx) => setVariants((arr) => arr.filter((_, i) => i !== idx));

  const updateVariant = (idx, patch) =>
    setVariants((arr) => arr.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  // ====== SKU generator ======
  const code = (s = '') => slugify(String(s)).replace(/-/g, '').toUpperCase();
  const genSkuCandidate = (v) => {
    const base = code(name).slice(0, 6);
    const c = code(v.color).slice(0, 3);
    const sz = code(v.size);
    return [base, c, sz].filter(Boolean).join('-');
  };
  const ensureUniqueSku = (candidate, used) => {
    let sku = candidate || 'SKU';
    let i = 1;
    while (used.has(sku)) {
      i++;
      sku = `${candidate}-${i}`;
    }
    used.add(sku);
    return sku;
  };
  const generateSkuForIndex = (idx) => {
    setVariants((arr) => {
      const used = new Set(
        arr.map((x, i) => (i === idx ? null : String(x.sku || ''))).filter(Boolean),
      );
      const v = arr[idx];
      const cand = genSkuCandidate(v);
      const sku = ensureUniqueSku(cand, used);
      const next = arr.slice();
      next[idx] = { ...v, sku };
      return next;
    });
  };
  const bulkGenerateSku = () => {
    setVariants((arr) => {
      const used = new Set(arr.map((x) => String(x.sku || '')).filter(Boolean));
      return arr.map((v) => {
        if (v.sku) return v;
        const cand = genSkuCandidate(v);
        const sku = ensureUniqueSku(cand, used);
        return { ...v, sku };
      });
    });
  };

  // ====== attributes (key-value) ======
  const addAttr = () => {
    setAttributes((obj) => {
      const keys = Object.keys(obj);
      const base = 'attr';
      let i = 1;
      let candidate = 'brand';
      if (keys.includes('brand')) {
        while (keys.includes(`${base}${i}`)) i++;
        candidate = `${base}${i}`;
      }
      return { ...obj, [candidate]: '' };
    });
  };

  const updateAttrKey = (oldKey, newKey) => {
    setAttributes((obj) => {
      const next = { ...obj };
      const val = next[oldKey];
      delete next[oldKey];
      next[newKey] = val ?? '';
      return next;
    });
  };

  const updateAttrVal = (key, val) => {
    setAttributes((obj) => ({ ...obj, [key]: val }));
  };

  const removeAttr = (key) => {
    setAttributes((obj) => {
      const next = { ...obj };
      delete next[key];
      return next;
    });
  };

  // ====== validate & submit ======
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    const errs = [];
    if (uploading > 0) errs.push('Đang tải ảnh, vui lòng đợi hoàn tất trước khi lưu.');

    // validate cơ bản
    if (!name.trim()) errs.push('Vui lòng nhập tên sản phẩm.');
    if (!categoryId) errs.push('Vui lòng chọn danh mục.');
    if (!images.length || !images.some((im) => im.publicId)) {
      errs.push('Cần ít nhất 1 ảnh sản phẩm.');
    }
    if (!variants.length) {
      errs.push('Cần ít nhất 1 biến thể.');
    }

    // tự tạo SKU cho biến thể thiếu
    let filledVariants = variants;
    {
      const used = new Set(variants.map((x) => String(x.sku || '')).filter(Boolean));
      filledVariants = variants.map((v) => {
        if (v.sku) return v;
        const cand = genSkuCandidate(v);
        const sku = ensureUniqueSku(cand, used);
        return { ...v, sku };
      });
      if (JSON.stringify(filledVariants) !== JSON.stringify(variants)) {
        setVariants(filledVariants);
      }
    }

    // ép kiểu và kiểm tra biến thể
    const normVariants = filledVariants.map((v) => ({
      ...v,
      sku: String(v.sku || '').trim(),
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    }));
    if (normVariants.some((v) => !v.sku)) errs.push('Mỗi biến thể cần SKU.');
    if (normVariants.some((v) => v.price <= 0)) errs.push('Giá mỗi biến thể phải lớn hơn 0.');
    if (normVariants.some((v) => v.stock < 0)) errs.push('Tồn kho mỗi biến thể phải ≥ 0.');
    const skus = normVariants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) errs.push('SKU của các biến thể phải khác nhau.');

    if (errs.length) {
      setErrors(errs);
      setErrorOpen(true);
      return;
    }

    // đảm bảo có 1 ảnh isPrimary
    let primaryMarked = images.some((im) => im.isPrimary);
    const finalImages = images.map((im, idx) => ({
      publicId: String(im.publicId || '').trim(),
      alt: String((im.alt || name).trim()),
      isPrimary: primaryMarked ? Boolean(im.isPrimary) : idx === 0,
    }));

    // loại bỏ thuộc tính key trống
    const attributesClean = Object.fromEntries(
      Object.entries(attributes)
        .map(([k, v]) => [String(k || '').trim(), String(v ?? '')])
        .filter(([k]) => !!k),
    );

    // đảm bảo slug tự sinh nếu rỗng
    const finalSlug = (slug || slugify(name)).trim();

    const payload = {
      name: name.trim(),
      slug: finalSlug,
      description,
      categoryId,
      attributes: attributesClean,
      images: finalImages,
      variants: normVariants,
      status: initial?.status || 'active',
    };

    try {
      setSaving(true);
      setErrors([]);
      await onSubmit?.(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset disabled={saving} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div ref={topRef} />
        {/* Hiển thị lỗi qua modal, không render hộp lỗi inline */}
        {/* Thông tin cơ bản */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.headerIcon}>📝</span>
            <span>Thông tin cơ bản</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.grid2}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span className={styles.labelStrong}>Tên sản phẩm</span>
                  <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Áo Polo nam basic"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <span className={styles.labelStrong}>Slug</span>
                  <span className={styles.optional}>(tùy chọn)</span>
                </label>
                <input
                  className={styles.input}
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="ao-polo-nam-basic"
                />
                <div className={styles.help}>💡 Tự động tạo từ tên sản phẩm nếu để trống</div>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span className={styles.labelStrong}>Danh mục</span>
                <span className={styles.required}>*</span>
              </label>
              {loadingCats ? (
                <div className={styles.loadingState}>
                  <span className={styles.spinner}></span>
                  <span>Đang tải danh mục...</span>
                </div>
              ) : (
                <select
                  className={styles.select}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn danh mục --</option>
                  {catOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {'— '.repeat(c.depth) + c.name} ({c.path})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span className={styles.labelStrong}>Mô tả sản phẩm</span>
                <span className={styles.required}>*</span>
              </label>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Mô tả chi tiết về sản phẩm: chất liệu, đặc điểm nổi bật, hướng dẫn sử dụng..."
                required
              />
            </div>
          </div>
        </section>

        {/* Ảnh */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.headerIcon}>🖼️</span>
            <span>Hình ảnh sản phẩm</span>
            <button className={`${styles.btn} ${styles.btnAdd}`} type="button" onClick={addImage}>
              <span>➕</span> Thêm ảnh
            </button>
          </div>
          <div className={styles.cardBody}>
            {uploading > 0 && (
              <div className={styles.uploadProgress}>
                <span className={styles.spinner}></span>
                <span>Đang tải lên {uploading} ảnh...</span>
              </div>
            )}
            {!images.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📷</span>
                <p>Chưa có ảnh nào</p>
                <p className={styles.emptyHint}>Thêm ảnh để khách hàng dễ hình dung sản phẩm hơn</p>
              </div>
            ) : (
              <div className={styles.imagesGrid}>
                {images.map((im, idx) => (
                  <div
                    key={idx}
                    className={`${styles.imageCard} ${im.isPrimary ? styles.primaryImage : ''}`}
                  >
                    {im.isPrimary && <div className={styles.primaryBadge}>⭐ Ảnh chính</div>}
                    {(im._previewUrl || im.publicId) && (
                      <div className={styles.imagePreviewWrap}>
                        <img
                          className={styles.imgPreview}
                          src={
                            im._previewUrl ||
                            `https://res.cloudinary.com/${
                              import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                            }/image/upload/f_auto,q_auto,w_400/${encodeURIComponent(im.publicId)}`
                          }
                          alt=""
                        />
                      </div>
                    )}
                    <div className={styles.imageActions}>
                      <label className={styles.uploadBtn}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const preview = URL.createObjectURL(f);
                              updateImage(idx, { _previewUrl: preview });
                              setUploading((u) => u + 1);
                              const r = await mediaApi.upload(f);
                              updateImage(idx, { publicId: r.publicId });
                            } catch (err) {
                              alert('Upload lỗi: ' + err.message);
                            } finally {
                              setUploading((u) => Math.max(0, u - 1));
                            }
                          }}
                        />
                        📁 {im.publicId ? 'Thay ảnh' : 'Chọn ảnh'}
                      </label>
                      <button
                        className={`${styles.btnIcon} ${
                          im.isPrimary ? styles.btnPrimaryActive : ''
                        }`}
                        type="button"
                        onClick={() => setPrimary(idx)}
                        title="Đặt làm ảnh chính"
                      >
                        ⭐
                      </button>
                      <button
                        className={styles.btnIcon}
                        type="button"
                        onClick={() => moveImage(idx, idx - 1)}
                        title="Di chuyển lên"
                      >
                        ↑
                      </button>
                      <button
                        className={styles.btnIcon}
                        type="button"
                        onClick={() => moveImage(idx, idx + 1)}
                        title="Di chuyển xuống"
                      >
                        ↓
                      </button>
                      <button
                        className={`${styles.btnIcon} ${styles.btnDelete}`}
                        type="button"
                        onClick={() => removeImage(idx)}
                        title="Xóa ảnh"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Variants */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.headerIcon}>🎨</span>
            <span>Biến thể sản phẩm</span>
            <button className={`${styles.btn} ${styles.btnAdd}`} type="button" onClick={addVariant}>
              <span>➕</span> Thêm biến thể
            </button>
          </div>
          <div className={styles.cardBody}>
            {!variants.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🎯</span>
                <p>Chưa có biến thể nào</p>
                <p className={styles.emptyHint}>
                  Thêm các phiên bản khác nhau (màu sắc, kích thước, giá cả...)
                </p>
              </div>
            ) : (
              <div className={styles.variantsContainer}>
                <div className={styles.variantsInfo}>
                  💡 SKU sẽ được tự động tạo khi lưu sản phẩm
                </div>
                {variants.map((v, idx) => (
                  <div key={idx} className={styles.variantCard}>
                    <div className={styles.variantHeader}>
                      <span className={styles.variantNumber}>#{idx + 1}</span>
                      <button
                        className={`${styles.btnIcon} ${styles.btnDelete}`}
                        type="button"
                        onClick={() => removeVariant(idx)}
                        title="Xóa biến thể"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                    <div className={styles.variantGrid}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Màu sắc</label>
                        <input
                          className={styles.input}
                          list="colorOptions"
                          value={v.color || ''}
                          onChange={(e) => updateVariant(idx, { color: e.target.value })}
                          placeholder="VD: Nâu nhạt, Xanh navy..."
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Kích thước</label>
                        <input
                          className={styles.input}
                          list="sizeOptions"
                          value={v.size || ''}
                          onChange={(e) => updateVariant(idx, { size: e.target.value })}
                          placeholder="VD: S, M, L, XL..."
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                          Giá bán <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="number"
                          value={v.price ?? 0}
                          onChange={(e) =>
                            updateVariant(idx, { price: Number(e.target.value || 0) })
                          }
                          placeholder="399000"
                          required
                          min={0}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                          Số lượng <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="number"
                          value={v.stock ?? 0}
                          onChange={(e) =>
                            updateVariant(idx, { stock: Number(e.target.value || 0) })
                          }
                          placeholder="10"
                          required
                          min={0}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label}>Hình ảnh riêng</label>
                        <label className={styles.uploadBtn}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                setUploading((u) => u + 1);
                                const r = await mediaApi.upload(f);
                                updateVariant(idx, { imagePublicId: r.publicId });
                              } catch (err) {
                                alert('Upload biến thể lỗi: ' + err.message);
                              } finally {
                                setUploading((u) => Math.max(0, u - 1));
                              }
                            }}
                          />
                          📁 {v.imagePublicId ? 'Đã có ảnh' : 'Chọn ảnh'}
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Attributes */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.headerIcon}>📋</span>
            <span>Thuộc tính bổ sung</span>
            <button className={`${styles.btn} ${styles.btnAdd}`} type="button" onClick={addAttr}>
              <span>➕</span> Thêm thuộc tính
            </button>
          </div>
          <div className={styles.cardBody}>
            {Object.keys(attributes).length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🏷️</span>
                <p>Chưa có thuộc tính nào</p>
                <p className={styles.emptyHint}>
                  Thêm thông tin như thương hiệu, chất liệu, xuất xứ...
                </p>
              </div>
            ) : (
              <div className={styles.attributesList}>
                {Object.entries(attributes).map(([k, v], idx) => (
                  <div key={`attr-${idx}-${k}`} className={styles.attributeRow}>
                    <div className={styles.attributeFields}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className={styles.label} htmlFor={`attr-key-${idx}`}>
                          Tên thuộc tính
                        </label>
                        <input
                          id={`attr-key-${idx}`}
                          className={styles.input}
                          value={k}
                          onChange={(e) => updateAttrKey(k, e.target.value)}
                          placeholder="VD: Thương hiệu, Chất liệu..."
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className={styles.label} htmlFor={`attr-val-${idx}`}>
                          Giá trị
                        </label>
                        <input
                          id={`attr-val-${idx}`}
                          className={styles.input}
                          value={v}
                          onChange={(e) => updateAttrVal(k, e.target.value)}
                          placeholder="VD: UrbanFit, Cotton 100%..."
                        />
                      </div>
                    </div>
                    <button
                      className={`${styles.btnIcon} ${styles.btnDelete}`}
                      type="button"
                      onClick={() => removeAttr(k)}
                      title="Xóa thuộc tính"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className={styles.footerSpace} />
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnBack}`}
            type="button"
            onClick={() => window.history.back()}
          >
            <span style={{ fontSize: 20 }}>↩️</span> Quay lại
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
            {saving ? '⏳ Đang lưu...' : '✅ Lưu sản phẩm'}
          </button>
        </div>

        {/* ComboBox options */}
        <datalist id="colorOptions">
          {COLOR_OPTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="sizeOptions">
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {/* Đã bỏ MediaPicker */}
      </fieldset>
      <ConfirmModal
        open={errorOpen}
        title="Thiếu thông tin cần thiết"
        confirmText="Đã hiểu"
        cancelText=""
        hideCancel
        confirmType="primary"
        onConfirm={() => setErrorOpen(false)}
        onCancel={() => setErrorOpen(false)}
        contentClassName={styles.errorContent}
        message={
          <div>
            <div style={{ marginBottom: 8 }}>Vui lòng kiểm tra và bổ sung các mục sau:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        }
      />
    </form>
  );
}

// styles handled by CSS module
