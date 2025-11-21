import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function FAQPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Hỏi đáp - FAQs',
    sections: [
      {
        heading: 'Làm sao để đặt hàng?',
        content: `Bạn chọn sản phẩm, thêm vào giỏ hàng, điền thông tin giao hàng và chọn phương thức thanh toán. Sau đó nhấn "Đặt hàng" để hoàn tất.`,
      },
      {
        heading: 'Có những hình thức thanh toán nào?',
        content: `- Thanh toán khi nhận hàng (COD)
- Chuyển khoản ngân hàng
- Ví điện tử (Momo, ZaloPay)
- Thẻ tín dụng/ghi nợ`,
      },
      {
        heading: 'Làm sao để kiểm tra đơn hàng?',
        content: `Đăng nhập tài khoản > Vào mục "Đơn hàng của tôi" để xem chi tiết và trạng thái đơn hàng.`,
      },
      {
        heading: 'Tôi có thể hủy đơn hàng không?',
        content: `Có. Nếu đơn hàng chưa được xử lý, bạn có thể hủy trực tiếp trong "Đơn hàng của tôi" hoặc liên hệ hotline.`,
      },
      {
        heading: 'Sản phẩm bị lỗi thì xử lý thế nào?',
        content: `Liên hệ ngay hotline 1900.272737 hoặc email contact@tnqfashion.vn. Chúng tôi sẽ đổi sản phẩm mới hoặc hoàn tiền 100%.`,
      },
      {
        heading: 'Có cửa hàng offline không?',
        content: `Hiện tại TnQ Fashion chưa có cửa hàng offline. Chúng tôi chỉ bán hàng online để giảm chi phí và mang lại giá tốt nhất cho khách hàng.`,
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
