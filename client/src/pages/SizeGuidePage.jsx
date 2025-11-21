import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function SizeGuidePage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Hướng dẫn chọn size',
    sections: [
      {
        heading: 'Bảng size áo',
        content: `Size S: Chiều cao 1m50-1m60, Cân nặng 45-52kg
Size M: Chiều cao 1m55-1m65, Cân nặng 50-58kg
Size L: Chiều cao 1m60-1m70, Cân nặng 56-65kg
Size XL: Chiều cao 1m65-1m75, Cân nặng 63-72kg`,
      },
      {
        heading: 'Bảng size quần',
        content: `Size S: Vòng eo 60-64cm, Vòng mông 86-90cm
Size M: Vòng eo 64-68cm, Vòng mông 90-94cm
Size L: Vòng eo 68-72cm, Vòng mông 94-98cm
Size XL: Vòng eo 72-76cm, Vòng mông 98-102cm`,
      },
      {
        heading: 'Cách đo size chính xác',
        content: `1. Đo vòng ngực: Đo ngang qua điểm đầy đặn nhất của ngực
2. Đo vòng eo: Đo vòng eo tự nhiên, không thắt quá chặt
3. Đo vòng mông: Đo quanh phần rộng nhất của hông
4. Chiều dài áo/quần: Đo từ vai xuống điểm muốn áo/quần kết thúc`,
      },
      {
        heading: 'Lưu ý khi chọn size',
        content: `- Nếu cân nặng nằm giữa 2 size, nên chọn size lớn hơn
- Mỗi dòng sản phẩm có thể fit khác nhau, tham khảo phần mô tả
- Liên hệ tư vấn qua chat nếu chưa chắc chắn
- Có thể đổi size miễn phí trong 7 ngày`,
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
