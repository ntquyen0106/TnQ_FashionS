import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function ShippingPolicyPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Chính sách giao hàng',
    sections: [
      {
        heading: 'Phạm vi giao hàng',
        content: `TnQ Fashion giao hàng toàn quốc qua các đơn vị vận chuyển uy tín.`,
      },
      {
        heading: 'Thời gian giao hàng',
        content: `- Nội thành Hà Nội: 1-2 ngày
- Các tỉnh thành khác: 3-5 ngày
- Vùng xa, hải đảo: 5-7 ngày
(Không tính thứ 7, Chủ nhật và ngày lễ)`,
      },
      {
        heading: 'Phí vận chuyển',
        content: `- Đơn hàng từ 500.000đ: Miễn phí giao hàng
- Đơn hàng dưới 500.000đ: 
  + Nội thành: 30.000đ
  + Ngoại thành: 50.000đ
  + Tỉnh khác: 40.000đ`,
      },
      {
        heading: 'Kiểm tra hàng',
        content: `- Khách hàng được quyền kiểm tra hàng trước khi thanh toán
- Nếu sản phẩm bị lỗi, từ chối nhận hàng và liên hệ ngay hotline
- Không nhận hàng nếu bao bì bị rách, móp méo`,
      },
      {
        heading: 'Lưu ý',
        content: `- Vui lòng cung cấp đầy đủ thông tin người nhận
- Đảm bảo có người nhận hàng theo thời gian hẹn
- Liên hệ hotline 1900.272737 nếu cần hỗ trợ`,
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
