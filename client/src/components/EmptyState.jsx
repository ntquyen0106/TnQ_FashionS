export default function EmptyState({ title = 'Không có dữ liệu', desc, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#666' }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      {desc && <div style={{ marginTop: 6 }}>{desc}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
