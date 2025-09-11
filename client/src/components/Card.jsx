export default function Card({ title, children, actions }) {
  return (
    <div
      className="card"
      style={{ padding: 16, borderRadius: 12, boxShadow: '0 1px 6px #0001', background: '#fff' }}
    >
      {title && <div style={{ fontWeight: 600, marginBottom: 10 }}>{title}</div>}
      <div>{children}</div>
      {actions && <div style={{ marginTop: 12 }}>{actions}</div>}
    </div>
  );
}
