import { useEffect, useState } from 'react';
import { mediaApi } from '@/api/media-api';

export default function MediaPicker({ open, onClose, onSelect, prefix = 'products' }) {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setNext(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefix]);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await mediaApi.search({ prefix, nextCursor: next });
      setItems((arr) => [...arr, ...(res.items || [])]);
      setNext(res.nextCursor || null);
    } catch (e) {
      console.error('media search failed', e);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>Media library</div>
        <div style={{ padding: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
              maxHeight: 420,
              overflow: 'auto',
            }}
          >
            {items.map((im) => (
              <button key={im.publicId} style={card} onClick={() => onSelect(im)}>
                <img
                  src={im.url}
                  alt=""
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
                />
                <div style={{ fontSize: 12, marginTop: 6, textAlign: 'left' }}>{im.publicId}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={onClose}>Đóng</button>
            <button onClick={load} disabled={loading || !next}>
              {next ? (loading ? 'Đang tải…' : 'Tải thêm') : 'Hết'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
};
const modal = { width: 900, background: '#fff', borderRadius: 10, overflow: 'hidden' };
const header = { padding: '10px 12px', borderBottom: '1px solid #eee', fontWeight: 600 };
const card = {
  border: '1px solid #eee',
  borderRadius: 8,
  padding: 6,
  cursor: 'pointer',
  background: '#fff',
};
