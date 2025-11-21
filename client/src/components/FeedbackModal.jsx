import { useState } from 'react';
import s from './FeedbackModal.module.css';

export default function FeedbackModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    message: '',
    phone: '',
    attachments: [],
  });
  const [selectedFiles, setSelectedFiles] = useState([]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setFormData((prev) => ({ ...prev, attachments: files }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement API call to submit feedback
    console.log('Feedback submitted:', formData);
    alert('Cảm ơn bạn đã gửi ý kiến đóng góp!');
    onClose();
    // Reset form
    setFormData({ message: '', phone: '', attachments: [] });
    setSelectedFiles([]);
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <button className={s.closeBtn} onClick={onClose} aria-label="Đóng">
          ×
        </button>

        <div className={s.header}>
          <h2 className={s.heading}>GỬI Ý KIẾN CHO TnQ FASHION</h2>
          <p className={s.subheading}>Cảm ơn bạn đã dành thời gian ở đây lúc này!</p>
          <p className={s.description}>
            TnQ đã sẵn sàng lắng nghe những ý kiến đóng góp của bạn rồi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={s.form}>
          <div className={s.formGroup}>
            <label className={s.label}>
              Bạn có gì muốn nhắn nhủ với TnQ Fashion ạ? <span className={s.required}>*</span>
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              className={s.textarea}
              placeholder="Tôi đã 256 ký tự"
              maxLength={256}
              required
              rows={4}
            />
            <div className={s.charCount}>{formData.message.length}/256 ký tự</div>
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>
              Bạn cho TnQ xin lại SĐT nhé! <span className={s.required}>*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={s.input}
              placeholder="Để TnQ có thể liên hệ lại trong trường hợp chưa rõ, xử lý kịp thời cho bạn"
              required
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Đính kèm sản phẩm (nếu có)</label>
            <div className={s.fileUpload}>
              <input
                type="file"
                id="feedbackFiles"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className={s.fileInput}
              />
              <label htmlFor="feedbackFiles" className={s.fileLabel}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Tải ảnh lên (tối đa 5 ảnh)</span>
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <div className={s.fileList}>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className={s.fileName}>
                    📎 {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className={s.submitBtn}>
            Gửi thông tin
          </button>
        </form>
      </div>
    </div>
  );
}
