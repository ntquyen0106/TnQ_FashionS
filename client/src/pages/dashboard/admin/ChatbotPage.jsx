import { useEffect, useState } from 'react';
import { chatbotApi } from '@/api';

export default function ChatbotPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ intent: '', question: '', answer: '' });

  const load = async () => {
    try {
      const data = await chatbotApi.listTemplates(q);
      setItems(data.items || data || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.intent || !form.answer) return;
    await chatbotApi.createTemplate(form);
    setForm({ intent: '', question: '', answer: '' });
    await load();
  };

  const remove = async (id) => {
    await chatbotApi.deleteTemplate(id);
    await load();
  };

  return (
    <>
      <h2>Quản lý chatbot (template trả lời)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Danh sách</h3>
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Tìm…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
              Tìm
            </button>
          </div>
          <div className="cards">
            {items.map((t) => (
              <div className="card" key={t.id || t._id}>
                <b>{t.intent}</b>
                <div>Q: {t.question}</div>
                <div>A: {t.answer}</div>
                <button className="btn" onClick={() => remove(t.id || t._id)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Thêm template</h3>
          <form onSubmit={save} className="form" style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Intent"
              value={form.intent}
              onChange={(e) => setForm({ ...form, intent: e.target.value })}
            />
            <input
              placeholder="Câu hỏi mẫu (optional)"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            <textarea
              placeholder="Câu trả lời"
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
            <button className="btn">Lưu</button>
          </form>
        </div>
      </div>
    </>
  );
}
