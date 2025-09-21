export default function Footer() {
  return (
    <footer
      style={{
        marginTop: '40px',
        padding: '20px 0',
        backgroundColor: '#f8f8f8',
        borderTop: '1px solid #ddd',
        textAlign: 'center',
        fontSize: '14px',
        color: '#555',
      }}
    >
      <div className="container">
        <p>&copy; {new Date().getFullYear()} TnQ Fashion. All rights reserved.</p>
        <p>
          <a href="/about" style={{ marginRight: 12 }}>
            Giới thiệu
          </a>
          <a href="/contact" style={{ marginRight: 12 }}>
            Liên hệ
          </a>
          <a href="/privacy">Chính sách bảo mật</a>
        </p>
      </div>
    </footer>
  );
}
