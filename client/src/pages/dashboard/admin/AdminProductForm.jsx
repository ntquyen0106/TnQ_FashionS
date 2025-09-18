import { useEffect, useMemo, useState } from 'react';
import { getCategories } from '@/api/category'; // đã có sẵn bên bạn
// Nếu bạn dùng toast, import vào và dùng ở onError
import { mediaApi } from '@/api/media-api';

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

  // ====== handlers variants ======
  const addVariant = () =>
    setVariants((arr) => [
      ...arr,
      { sku: '', color: '', size: '', price: 0, stock: 0, imagePublicId: '' },
    ]);

  const removeVariant = (idx) => setVariants((arr) => arr.filter((_, i) => i !== idx));

  const updateVariant = (idx, patch) =>
    setVariants((arr) => arr.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  // ====== attributes (key-value) ======
  const addAttr = () => setAttributes((obj) => ({ ...obj, '': '' }));

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
  const handleSubmit = (e) => {
    e.preventDefault();

    // validate đơn giản
    if (!name.trim()) return alert('Vui lòng nhập tên sản phẩm');
    if (!slug.trim()) return alert('Vui lòng nhập slug');
    if (!categoryId) return alert('Vui lòng chọn danh mục');
    if (!images.length || !images.some((im) => im.publicId)) {
      return alert('Cần ít nhất 1 ảnh có publicId');
    }
    if (!variants.length) {
      return alert('Cần ít nhất 1 biến thể (SKU/giá/stock...)');
    }
    // ép kiểu giá/stock thành số
    const normVariants = variants.map((v) => ({
      ...v,
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    }));

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description,
      categoryId,
      attributes,
      images: images.map((im) => ({
        publicId: String(im.publicId || '').trim(),
        alt: String(im.alt || ''),
        isPrimary: Boolean(im.isPrimary),
      })),
      variants: normVariants,
      status: 'active',
    };

    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
      {/* Thông tin cơ bản */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Thông tin cơ bản</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Tên sản phẩm
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên..."
              style={{ width: '100%', padding: 8, marginTop: 6 }}
              required
            />
          </label>
          <label>
            Slug
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="ao-khoac-du-2"
              style={{ width: '100%', padding: 8, marginTop: 6 }}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>
            Danh mục
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 6 }}
              required
            >
              <option value="">-- Chọn danh mục --</option>
              {loadingCats ? (
                <option value="">Đang tải…</option>
              ) : (
                catOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {'— '.repeat(c.depth) + c.name} ({c.path})
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <label style={{ marginTop: 12, display: 'block' }}>
          Mô tả
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
            placeholder="Mô tả ngắn gọn..."
          />
        </label>
      </section>

      {/* Ảnh */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Hình ảnh</h3>
          <button type="button" onClick={addImage}>
            + Thêm ảnh
          </button>
        </div>

        {!images.length ? (
          <div style={{ color: '#777' }}>Chưa có ảnh nào.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {images.map((im, idx) => (
              <div key={idx} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label>
                    Public ID
                    <input
                      value={im.publicId || ''}
                      onChange={(e) => updateImage(idx, { publicId: e.target.value })}
                      placeholder="folder/ten-anh"
                      style={{ width: '100%', padding: 8, marginTop: 6 }}
                    />
                  </label>
                  <label>
                    Alt
                    <input
                      value={im.alt || ''}
                      onChange={(e) => updateImage(idx, { alt: e.target.value })}
                      placeholder="Mô tả ảnh"
                      style={{ width: '100%', padding: 8, marginTop: 6 }}
                    />
                  </label>
                </div>

                {/* chọn file từ máy */}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        // (tuỳ chọn) preview local
                        const preview = URL.createObjectURL(f);
                        updateImage(idx, { _previewUrl: preview });

                        const r = await mediaApi.upload(f);
                        // Lưu publicId để submit về DB
                        updateImage(idx, { publicId: r.publicId });
                      } catch (err) {
                        alert('Upload lỗi: ' + err.message);
                      }
                    }}
                  />
                  <button type="button" onClick={() => setPrimary(idx)}>
                    {im.isPrimary ? '✓ Ảnh chính' : 'Đặt làm ảnh chính'}
                  </button>
                  <button type="button" onClick={() => removeImage(idx)}>
                    Xóa
                  </button>
                </div>

                {/* hiển thị preview nếu có */}
                {(im._previewUrl || im.publicId) && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={
                        im._previewUrl ||
                        `https://res.cloudinary.com/${
                          import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                        }/image/upload/f_auto,q_auto,w_400/${encodeURIComponent(im.publicId)}`
                      }
                      alt=""
                      style={{ maxWidth: 220, borderRadius: 8 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Variants */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Biến thể</h3>
          <button type="button" onClick={addVariant}>
            + Thêm biến thể
          </button>
        </div>

        {!variants.length ? (
          <div style={{ color: '#777' }}>Chưa có biến thể nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={th}>SKU*</th>
                  <th style={th}>Màu</th>
                  <th style={th}>Size</th>
                  <th style={th}>Giá*</th>
                  <th style={th}>Tồn*</th>
                  <th style={th}>imagePublicId</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, idx) => (
                  <tr key={idx}>
                    <td style={td}>
                      <input
                        value={v.sku || ''}
                        onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                        placeholder="AKD2-NAU-S"
                        style={inp}
                        required
                      />
                    </td>
                    <td style={td}>
                      <input
                        value={v.color || ''}
                        onChange={(e) => updateVariant(idx, { color: e.target.value })}
                        placeholder="Nâu nhạt"
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <input
                        value={v.size || ''}
                        onChange={(e) => updateVariant(idx, { size: e.target.value })}
                        placeholder="S"
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        value={v.price ?? 0}
                        onChange={(e) => updateVariant(idx, { price: Number(e.target.value || 0) })}
                        placeholder="399000"
                        style={inp}
                        required
                        min={0}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        value={v.stock ?? 0}
                        onChange={(e) => updateVariant(idx, { stock: Number(e.target.value || 0) })}
                        placeholder="10"
                        style={inp}
                        required
                        min={0}
                      />
                    </td>
                    <td style={td}>
                      <input
                        value={v.imagePublicId || ''}
                        onChange={(e) => updateVariant(idx, { imagePublicId: e.target.value })}
                        placeholder="folder/anh-bien-the"
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <button type="button" onClick={() => removeVariant(idx)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Attributes */}
      <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>Thuộc tính</h3>
          <button type="button" onClick={addAttr}>
            + Thêm thuộc tính
          </button>
        </div>

        {Object.keys(attributes).length === 0 ? (
          <div style={{ color: '#777' }}>Chưa có thuộc tính.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(attributes).map(([k, v]) => (
              <div
                key={k + Math.random()}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}
              >
                <input
                  value={k}
                  onChange={(e) => updateAttrKey(k, e.target.value)}
                  placeholder="brand"
                  style={inp}
                />
                <input
                  value={v}
                  onChange={(e) => updateAttrVal(k, e.target.value)}
                  placeholder="UrbanFit"
                  style={inp}
                />
                <button type="button" onClick={() => removeAttr(k)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => window.history.back()}>
          Hủy
        </button>
        <button type="submit">Lưu sản phẩm</button>
      </div>
    </form>
  );
}

const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #eee' };
const td = { padding: '8px 10px', borderBottom: '1px solid #f2f2f2', verticalAlign: 'top' };
const inp = { width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 };
