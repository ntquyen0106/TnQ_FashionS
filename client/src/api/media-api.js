// src/api/media-api.js
const API_BASE = import.meta.env.VITE_API_URL || '';

const mediaApi = {
  upload: async (file) => {
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch(`${API_BASE}/api/media/upload`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Upload failed: ${res.status} ${t}`);
    }
    return res.json(); // { publicId, url, ... }
  },
  search: async ({ prefix = 'products', nextCursor, max = 30 } = {}) => {
    const qs = new URLSearchParams();
    if (prefix) qs.set('prefix', prefix);
    if (nextCursor) qs.set('nextCursor', nextCursor);
    if (max) qs.set('max', String(max));
    const res = await fetch(`${API_BASE}/api/media/search?${qs.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  },
};

// 👇 Export cả named và default để tránh nhầm lẫn
export { mediaApi };
export default mediaApi;
