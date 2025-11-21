import { useState, useEffect } from 'react';
import s from './StaticPage.module.css';

export default function AboutPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch từ API
    // fetch('/api/pages/about').then(res => res.json()).then(setContent)
    setLoading(false);
  }, []);

  const defaultContent = {
    title: 'Giới thiệu về TnQ Fashion',
    sections: [
      {
        heading: 'Về chúng tôi',
        content: `TnQ Fashion là thương hiệu thời trang trẻ trung, năng động, cam kết mang đến những sản phẩm chất lượng cao với giá cả hợp lý. 
        
Chúng tôi luôn lắng nghe và không ngừng cải tiến để đáp ứng nhu cầu của khách hàng.`,
      },
      {
        heading: 'Sứ mệnh',
        content: `Mang đến phong cách thời trang hiện đại, tiện lợi và phù hợp với mọi lứa tuổi. 
        
Tạo dựng niềm tin và trải nghiệm mua sắm tuyệt vời cho khách hàng.`,
      },
      {
        heading: 'Giá trị cốt lõi',
        content: `- Chất lượng sản phẩm luôn được đặt lên hàng đầu
- Dịch vụ khách hàng tận tâm, chu đáo
- Giá cả minh bạch, hợp lý
- Đổi mới không ngừng`,
      },
    ],
  };

  const data = content || defaultContent;

  if (loading) {
    return <div className={s.loading}>Đang tải...</div>;
  }

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
