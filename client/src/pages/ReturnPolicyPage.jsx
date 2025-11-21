import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function ReturnPolicyPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Chính sách đổi trả',
    sections: [
      {
        heading: 'Điều kiện đổi trả',
        content: `- Sản phẩm còn nguyên tem mác, chưa qua sử dụng
- Trong vòng 7 ngày kể từ ngày nhận hàng
- Có hóa đơn mua hàng
- Sản phẩm không thuộc danh mục không được đổi trả`,
      },
      {
        heading: 'Quy trình đổi trả',
        content: `1. Liên hệ hotline 1900.272737 hoặc email: contact@tnqfashion.vn
2. Cung cấp thông tin đơn hàng và lý do đổi trả
3. Đóng gói sản phẩm cẩn thận
4. Gửi hàng về địa chỉ TnQ Fashion cung cấp
5. Nhận lại tiền hoặc sản phẩm đổi trong 3-5 ngày làm việc`,
      },
      {
        heading: 'Chi phí đổi trả',
        content: `- Lỗi từ nhà sản xuất: TnQ Fashion chịu toàn bộ chi phí
- Đổi size/màu: Khách hàng chịu phí vận chuyển
- Không vừa ý: Khách hàng chịu phí vận chuyển 2 chiều`,
      },
      {
        heading: 'Lưu ý',
        content: `Một số sản phẩm khuyến mãi đặc biệt có thể không áp dụng chính sách đổi trả.
Vui lòng kiểm tra kỹ trước khi mua hàng.`,
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
