import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function PrivacyPolicyPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Chính sách bảo mật',
    sections: [
      {
        heading: 'Cam kết bảo mật thông tin',
        content: `TnQ Fashion cam kết bảo mật tuyệt đối thông tin cá nhân của khách hàng theo quy định pháp luật.`,
      },
      {
        heading: 'Thông tin thu thập',
        content: `- Họ tên, số điện thoại, địa chỉ email
- Địa chỉ giao hàng
- Lịch sử mua hàng
- Thông tin thanh toán (được mã hóa)`,
      },
      {
        heading: 'Mục đích sử dụng',
        content: `- Xử lý đơn hàng và giao hàng
- Chăm sóc khách hàng
- Gửi thông tin khuyến mãi (nếu đồng ý)
- Cải thiện dịch vụ`,
      },
      {
        heading: 'Bảo vệ thông tin',
        content: `- Sử dụng công nghệ mã hóa SSL
- Lưu trữ an toàn trên hệ thống bảo mật
- Chỉ nhân viên được ủy quyền mới truy cập
- Không chia sẻ với bên thứ ba khi chưa có sự đồng ý`,
      },
      {
        heading: 'Quyền của khách hàng',
        content: `- Yêu cầu xem, chỉnh sửa thông tin cá nhân
- Yêu cầu xóa thông tin
- Từ chối nhận email marketing
- Liên hệ: contact@tnqfashion.vn`,
      },
    ],
  };

  const data = content || defaultContent;

  if (loading) return <div className={s.loading}>Đang tải...</div>;

  return (
    <div className={s.container}>
      <div className={s.page}>
        <h1 className={s.pageTitle}>{data.title}</h1>
        {data.sections.map((section, idx) => (
          <div key={idx} className={s.section}>
            <h2 className={s.sectionTitle}>{section.heading}</h2>
            <div className={s.content}>
              {section.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
