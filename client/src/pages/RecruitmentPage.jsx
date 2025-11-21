import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function RecruitmentPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Tuyển dụng',
    sections: [
      {
        heading: 'Cơ hội nghề nghiệp tại TnQ Fashion',
        content: `Chúng tôi luôn tìm kiếm những tài năng trẻ, nhiệt huyết để cùng phát triển.`,
      },
      {
        heading: 'Vị trí đang tuyển',
        content: `- Nhân viên bán hàng
- Nhân viên kho
- Nhân viên marketing
- Chuyên viên chăm sóc khách hàng`,
      },
      {
        heading: 'Quyền lợi',
        content: `- Lương cạnh tranh + thưởng theo doanh số
- Bảo hiểm đầy đủ theo quy định
- Môi trường làm việc năng động, thân thiện
- Cơ hội thăng tiến rõ ràng`,
      },
      {
        heading: 'Liên hệ',
        content: `Gửi CV về email: hr@tnqfashion.vn hoặc liên hệ hotline: 1900.272737`,
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
